<?php
namespace SERVETECH_DP;

if ( ! defined( 'ABSPATH' ) ) exit;

class Plugin {

    /** @var string[] Donation SKUs created */
    private $donation_skus = array( 'servetech-don-5', 'servetech-don-10', 'servetech-don-15' );

    public function run() {
        // Activation hook: create donation products
        register_activation_hook( SERVETECH_DP_FILE, array( $this, 'on_activate' ) );
        error_log("This is running");
        // Ensure products exist on every page load
        add_action( 'init', array( $this, 'ensure_donation_products_exist' ) );
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
        $this->ensure_donation_products_exist();
    }
    // Add this new method
    public function ensure_donation_products_exist() {
        error_log("This is ensure_donation");
        if ( ! function_exists( 'wc_get_product_id_by_sku' ) ) {
            error_log( 'SERVETECH_DP: WooCommerce not active or wc_get_product_id_by_sku missing' );
            return;
        }

        foreach ( $this->donation_skus as $sku ) {
            $existing_id = wc_get_product_id_by_sku( $sku );
            if ( $existing_id ) {
                error_log( "SERVETECH_DP: Donation product exists: SKU=$sku, ID=$existing_id" );
                continue;
            }

            error_log( "SERVETECH_DP: Creating missing donation product: SKU=$sku" );
            $this->create_donation_product_by_sku( $sku );
        }
    }

    private function create_donation_product_by_sku( $sku ) {
        $amount = 0;
        if ( false !== strpos( $sku, '5' ) ) $amount = 5;
        if ( false !== strpos( $sku, '10' ) ) $amount = 10;
        if ( false !== strpos( $sku, '15' ) ) $amount = 15;

        $product = new \WC_Product_Simple();
        $product->set_name( 'Donation - $' . $amount ); // Plain text
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

        error_log( "SERVETECH_DP: Created donation product ID=$id, SKU=$sku" );

        return $id;
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

        error_log( 'SERVETECH_DP AJAX: ' . print_r( $_POST, true ) );

        if ( empty( $_POST['product_id'] ) ) {
            error_log( 'SERVETECH_DP ERROR: Missing product_id' );
            wp_send_json_error( array( 'message' => 'Missing product_id' ), 400 );
        }

        $product_id   = absint( $_POST['product_id'] );
        $quantity     = isset( $_POST['quantity'] ) ? absint( $_POST['quantity'] ) : 1;
        $variation_id = ! empty( $_POST['variation_id'] ) ? absint( $_POST['variation_id'] ) : 0;
        $variation    = ! empty( $_POST['variation'] ) && is_array( $_POST['variation'] )
                            ? array_map( 'sanitize_text_field', $_POST['variation'] )
                            : array();

        // ---- ADD MAIN PRODUCT (simple or variation) -------------------------
        $cart_item_key = WC()->cart->add_to_cart(
            $product_id,
            $quantity,
            $variation_id,
            $variation
        );

        if ( ! $cart_item_key ) {
            error_log( "SERVETECH_DP ERROR: Failed to add main product ID=$product_id" );
            wp_send_json_error( array( 'message' => 'Could not add main product to cart' ), 500 );
        }

        error_log( "SERVETECH_DP: Main product added. Cart item key: $cart_item_key" );

        // ---- OPTIONAL DONATION ------------------------------------------------
        $donation_sku = isset( $_POST['donation_sku'] ) ? sanitize_text_field( $_POST['donation_sku'] ) : '';
        error_log( "SERVETECH_DP: Donation SKU received: '$donation_sku'" );

        if ( $donation_sku ) {
            $donation_id = wc_get_product_id_by_sku( $donation_sku );
            error_log( "SERVETECH_DP: Donation ID by SKU '$donation_sku': " . ($donation_id ?: 'NOT FOUND') );

            if ( $donation_id ) {
                $donation_added = WC()->cart->add_to_cart( $donation_id, 1 );
                error_log( "SERVETECH_DP: Donation added: " . ($donation_added ? 'YES' : 'NO') );
            } else {
                error_log( "SERVETECH_DP ERROR: Donation product not found for SKU: $donation_sku" );
            }
        }

        wp_send_json_success( array( 'cart_url' => wc_get_cart_url() ) );
    }
}