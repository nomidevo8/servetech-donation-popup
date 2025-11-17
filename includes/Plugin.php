<?php
/**
 * Plugin Name: ServeTech Donation Popup
 * Description: Donation + Recipient form on Add to Cart. One AJAX. Saves recipient data to order.
 * Version: 1.0.0
 * Author: ServeTech
 * Text Domain: servetech-dp
 */

namespace SERVETECH_DP;

use SERVETECH_DP\Admin\Settings;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

if ( ! defined( 'SERVETECH_DP_FILE' ) ) {
    define( 'SERVETECH_DP_FILE', __FILE__ );
}
if ( ! defined( 'SERVETECH_DP_URL' ) ) {
    define( 'SERVETECH_DP_URL', plugin_dir_url( __FILE__ ) );
}
if ( ! defined( 'SERVETECH_DP_VERSION' ) ) {
    define( 'SERVETECH_DP_VERSION', '1.0.0' );
}

class Plugin {

    /** @var string[] Donation SKUs */
    private $donation_skus = [ 'servetech-don-5', 'servetech-don-10', 'servetech-don-15' ];

    /** @var Settings */
    private $settings;

    public function run() {
        register_activation_hook( SERVETECH_DP_FILE, [ $this, 'on_activate' ] );

        $this->settings = new Settings( $this );
        $this->settings->init();

        add_action( 'init', [ $this, 'ensure_donation_products_exist' ] );
        add_action( 'wp_enqueue_scripts', [ $this, 'enqueue_assets' ] );

        // AJAX: Old flow (kept for fallback)
        add_action( 'wp_ajax_servetech_add_to_cart_with_donation', [ $this, 'ajax_add_to_cart_with_donation' ] );
        add_action( 'wp_ajax_nopriv_servetech_add_to_cart_with_donation', [ $this, 'ajax_add_to_cart_with_donation' ] );

        // AJAX: New flow – main + donation + recipient
        add_action( 'wp_ajax_servetech_add_to_cart_with_recipient', [ $this, 'ajax_add_to_cart_with_recipient' ] );
        add_action( 'wp_ajax_nopriv_servetech_add_to_cart_with_recipient', [ $this, 'ajax_add_to_cart_with_recipient' ] );

        // Save recipient meta to order
        add_action( 'woocommerce_checkout_create_order_line_item', [ $this, 'save_recipient_to_order_item' ], 10, 4 );

        // Admin: Recipient column
        add_action( 'woocommerce_admin_order_item_headers', [ $this, 'add_recipient_column_header' ] );
        add_action( 'woocommerce_admin_order_item_values', [ $this, 'add_recipient_column_value' ], 10, 3 );
    }

    public function on_activate() {
        $this->ensure_donation_products_exist();
    }

    public function ensure_donation_products_exist() {
        if ( ! function_exists( 'wc_get_product_id_by_sku' ) ) {
            error_log( 'SERVETECH_DP: WooCommerce not active.' );
            return;
        }

        foreach ( $this->donation_skus as $sku ) {
            if ( wc_get_product_id_by_sku( $sku ) ) {
                continue;
            }
            $this->create_donation_product_by_sku( $sku );
        }
    }

    private function create_donation_product_by_sku( $sku ) {
        $amount = 0;
        if ( strpos( $sku, '5' ) !== false )  $amount = 5;
        if ( strpos( $sku, '10' ) !== false ) $amount = 10;
        if ( strpos( $sku, '15' ) !== false ) $amount = 15;

        $product = new \WC_Product_Simple();
        $product->set_name( "Donation - \${$amount}" );
        $product->set_status( 'publish' );
        $product->set_catalog_visibility( 'hidden' );
        $product->set_price( $amount );
        $product->set_regular_price( $amount );
        $product->set_sku( $sku );
        $product->set_virtual( true );
        $product->set_manage_stock( false );
        $product->set_sold_individually( false );

        $id = $product->save();

        if ( $id && function_exists( 'wc_update_product_lookup_tables' ) ) {
            wc_update_product_lookup_tables( $id );
        }

        update_post_meta( $id, '_servetech_is_donation', 'yes' );
        clean_post_cache( $id );
        wp_cache_delete( 'product-' . $id, 'products' );

        return $id;
    }

    public function enqueue_assets() {
        if ( ! function_exists( 'is_woocommerce' ) ) return;

        wp_register_style(
            'servetech-dp-style',
            SERVETECH_DP_URL . 'assets/css/style.css',
            [],
            SERVETECH_DP_VERSION
        );

        wp_register_script(
            'servetech-dp-frontend',
            SERVETECH_DP_URL . 'assets/js/frontend.js',
            [ 'jquery' ],
            SERVETECH_DP_VERSION,
            true
        );

        $donation_products = [
            '5'  => wc_get_product_id_by_sku( 'servetech-don-5' ),
            '10' => wc_get_product_id_by_sku( 'servetech-don-10' ),
            '15' => wc_get_product_id_by_sku( 'servetech-don-15' ),
        ];

        wp_localize_script( 'servetech-dp-frontend', 'SERVETECH_DP', [
            'ajax_url'    => admin_url( 'admin-ajax.php' ),
            'nonce'       => wp_create_nonce( 'servetech_dp_nonce' ),
            'donations'   => $donation_products,
            'cart_url'    => wc_get_cart_url(),
            'popup_image' => $this->settings->get_popup_image(),
            'logo_url'    => $this->settings->get_logo_url(),
        ] );

        wp_enqueue_style( 'servetech-dp-style' );
        wp_enqueue_script( 'servetech-dp-frontend' );
    }

    /**
     * Legacy AJAX (kept for fallback)
     */
    public function ajax_add_to_cart_with_donation() {
        check_ajax_referer( 'servetech_dp_nonce', 'nonce' );

        if ( empty( $_POST['product_id'] ) ) {
            wp_send_json_error( [ 'message' => 'Missing product_id' ], 400 );
        }

        $product_id   = absint( $_POST['product_id'] );
        $quantity     = isset( $_POST['quantity'] ) ? absint( $_POST['quantity'] ) : 1;
        $variation_id = ! empty( $_POST['variation_id'] ) ? absint( $_POST['variation_id'] ) : 0;
        $variation    = ! empty( $_POST['variation'] ) && is_array( $_POST['variation'] )
                            ? array_map( 'sanitize_text_field', $_POST['variation'] )
                            : [];

        $cart_item_key = WC()->cart->add_to_cart( $product_id, $quantity, $variation_id, $variation );
        if ( ! $cart_item_key ) {
            wp_send_json_error( [ 'message' => 'Could not add main product' ], 500 );
        }

        $donation_sku = isset( $_POST['donation_sku'] ) ? sanitize_text_field( $_POST['donation_sku'] ) : '';
        if ( $donation_sku ) {
            $donation_id = wc_get_product_id_by_sku( $donation_sku );
            if ( $donation_id ) {
                WC()->cart->add_to_cart( $donation_id, 1 );
            }
        }

        wp_send_json_success( [ 'cart_url' => wc_get_cart_url() ] );
    }

    /**
     * NEW AJAX: Main product + donation + recipient in ONE call
     */
    public function ajax_add_to_cart_with_recipient() {
        check_ajax_referer( 'servetech_dp_nonce', 'nonce' );

        if ( empty( $_POST['product_id'] ) ) {
            wp_send_json_error( [ 'message' => 'Missing product_id' ], 400 );
        }

        $product_id   = absint( $_POST['product_id'] );
        $quantity     = isset( $_POST['quantity'] ) ? absint( $_POST['quantity'] ) : 1;
        $variation_id = ! empty( $_POST['variation_id'] ) ? absint( $_POST['variation_id'] ) : 0;
        $variation    = ! empty( $_POST['variation'] ) && is_array( $_POST['variation'] )
                            ? array_map( 'sanitize_text_field', $_POST['variation'] )
                            : [];
        $donation_sku = isset( $_POST['donation_sku'] ) ? sanitize_text_field( $_POST['donation_sku'] ) : '';
        $recipient    = isset( $_POST['recipient'] ) && is_array( $_POST['recipient'] )
                            ? array_map( 'sanitize_text_field', $_POST['recipient'] )
                            : [];

        // Build custom cart item data (this is the ONLY way to add meta)
        $cart_item_data = [];

        if ( ! empty( $recipient ) ) {
            $cart_item_data = [
                '_servetech_recipient_first_name' => $recipient['first_name']   ?? '',
                '_servetech_recipient_last_name'  => $recipient['last_name']    ?? '',
                '_servetech_recipient_email'      => $recipient['email']        ?? '',
                '_servetech_card_message'         => $recipient['card_message'] ?? '',
                '_servetech_signed_from'          => $recipient['signed_from']  ?? '',
            ];
            // Filter out empty values
            $cart_item_data = array_filter( $cart_item_data );
        }

        // 1. Add main product WITH recipient meta
        $main_key = WC()->cart->add_to_cart(
            $product_id,
            $quantity,
            $variation_id,
            $variation,
            $cart_item_data  // This is where meta is attached!
        );

        if ( ! $main_key ) {
            wp_send_json_error( [ 'message' => 'Failed to add main product' ], 500 );
        }

        // 2. Add donation (optional)
        if ( $donation_sku ) {
            $donation_id = wc_get_product_id_by_sku( $donation_sku );
            if ( $donation_id ) {
                WC()->cart->add_to_cart( $donation_id, 1 );
            }
        }

        wp_send_json_success( [ 'cart_url' => wc_get_cart_url() ] );
    }

    /**
     * Save recipient meta to order item
     */

    public function save_recipient_to_order_item( $item, $cart_item_key, $values, $order ) {
        $map = [
            '_servetech_recipient_first_name' => 'Recipient First Name',
            '_servetech_recipient_last_name'  => 'Recipient Last Name',
            '_servetech_recipient_email'      => 'Recipient Email',
            '_servetech_card_message'         => 'Card Message',
            '_servetech_signed_from'          => 'Signed From',
        ];

        foreach ( $map as $meta_key => $label ) {
            if ( ! empty( $values[ $meta_key ] ) ) {
                $item->add_meta_data( $label, $values[ $meta_key ], true );
            }
        }
    }

    /**
     * Admin: Add Recipient column header
     */
    public function add_recipient_column_header() {
        echo '<th class="servetech-recipient sortable" data-sort="string-ins">Recipient</th>';
    }

    /**
     * Admin: Show recipient info in order items
     */
    public function add_recipient_column_value( $item ) {
        $first = $item->get_meta( '_servetech_recipient_first_name' );
        $last  = $item->get_meta( '_servetech_recipient_last_name' );
        $email = $item->get_meta( '_servetech_recipient_email' );

        if ( $first || $last || $email ) {
            $name = trim( $first . ' ' . $last );
            echo '<td class="servetech-recipient">';
            if ( $name ) {
                echo '<strong>' . esc_html( $name ) . '</strong>';
            }
            if ( $email ) {
                echo '<br><small>' . esc_html( $email ) . '</small>';
            }
            echo '</td>';
        } else {
            echo '<td class="servetech-recipient">—</td>';
        }
    }
}
