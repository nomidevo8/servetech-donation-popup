<?php
namespace SERVETECH_DP;

if ( ! defined( 'ABSPATH' ) ) exit;

class Plugin {

    /** @var string[] Donation SKUs created */
    private $donation_skus = array( 'servetech-don-5', 'servetech-don-10', 'servetech-don-15' );

    public function run() {
        // Activation hook: create donation products
        register_activation_hook( SERVETECH_DP_FILE, array( $this, 'on_activate' ) );

        // Enqueue frontend assets
        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_assets' ) );

        // AJAX handlers
        add_action( 'wp_ajax_servetech_add_to_cart_with_donation', array( $this, 'ajax_add_to_cart_with_donation' ) );
        add_action( 'wp_ajax_nopriv_servetech_add_to_cart_with_donation', array( $this, 'ajax_add_to_cart_with_donation' ) );
    }

    /**
     * Activation: create donation products if not exist
     */
    public function on_activate() {
        // create WC products programmatically
        if ( ! function_exists( 'wc_get_product_id_by_sku' ) ) {
            return; // WooCommerce not active
        }

        foreach ( $this->donation_skus as $sku ) {
            if ( false === wc_get_product_id_by_sku( $sku ) ) {
                $this->create_donation_product_by_sku( $sku );
            }
        }
    }

    private function create_donation_product_by_sku( $sku ) {
        $amount = 0;
        if ( strpos( $sku, '5' ) !== false ) $amount = 5;
        if ( strpos( $sku, '10' ) !== false ) $amount = 10;
        if ( strpos( $sku, '15' ) !== false ) $amount = 15;

        // Use WC_Product_Simple to create a simple product
        $product = new \WC_Product_Simple();
        $product->set_name( 'Donation - ' . wc_price( $amount ) );
        $product->set_status( 'publish' );
        $product->set_catalog_visibility( 'hidden' );
        $product->set_price( $amount );
        $product->set_regular_price( $amount );
        $product->set_sku( $sku );
        $product->set_virtual( true );
        $product->set_manage_stock( false );

        $id = $product->save();
        // mark as donation for reference
        update_post_meta( $id, '_servetech_is_donation', 'yes' );
    }

    public function enqueue_assets() {
        // only when WooCommerce is available
        if ( ! function_exists( 'is_woocommerce' ) ) return;

        wp_register_style( 'servetech-dp-style', SERVETECH_DP_URL . 'assets/css/style.css', array(), SERVETECH_DP_VERSION );
        wp_register_script( 'servetech-dp-frontend', SERVETECH_DP_URL . 'assets/js/frontend.js', array( 'jquery' ), SERVETECH_DP_VERSION, true );

        $donation_products = array(
            '5'  => wc_get_product_id_by_sku( 'servetech-don-5' ),
            '10' => wc_get_product_id_by_sku( 'servetech-don-10' ),
            '15' => wc_get_product_id_by_sku( 'servetech-don-15' ),
        );

        wp_localize_script( 'servetech-dp-frontend', 'SERVETECH_DP', array(
            'ajax_url' => admin_url( 'admin-ajax.php' ),
            'nonce'    => wp_create_nonce( 'servetech_dp_nonce' ),
            'donations'=> $donation_products,
            'cart_url' => wc_get_cart_url(),
        ) );

        wp_enqueue_style( 'servetech-dp-style' );
        wp_enqueue_script( 'servetech-dp-frontend' );
    }

    /**
     * AJAX handler: add original product + optional donation product, then return JSON
     */
    public function ajax_add_to_cart_with_donation() {
        check_ajax_referer( 'servetech_dp_nonce', 'nonce' );

        if ( empty( $_POST['product_id'] ) ) {
            wp_send_json_error( array( 'message' => 'Missing product_id' ), 400 );
        }

        $product_id = absint( $_POST['product_id'] );
        $qty = isset( $_POST['quantity'] ) ? absint( $_POST['quantity'] ) : 1;

        // add main product
        $added = WC()->cart->add_to_cart( $product_id, $qty );
        if ( ! $added ) {
            wp_send_json_error( array( 'message' => 'Could not add main product to cart' ), 500 );
        }

        // if donation chosen, add donation product by SKU mapping
        $donation_sku = isset( $_POST['donation_sku'] ) ? sanitize_text_field( $_POST['donation_sku'] ) : '';
        if ( $donation_sku ) {
            $donation_id = wc_get_product_id_by_sku( $donation_sku );
            if ( $donation_id ) {
                WC()->cart->add_to_cart( $donation_id, 1 );
            }
        }

        // return success; front-end will redirect to cart
        wp_send_json_success( array( 'cart_url' => wc_get_cart_url() ) );
    }
}
