<?php
/**
 * Plugin Name: SERVETECH Donation Popup
 * Description: Intercepts Add to Cart clicks and shows a donation popup (5,10,15). Adds donation product if selected.
 * Version: 1.0.0
 * Author: SERVETECH GLOBAL
 * Text Domain: servetech-donation-popup
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Basic plugin constants
define( 'SERVETECH_DP_VERSION', '1.0.0.1345' );
// define( 'SERVETECH_DP_VERSION', time());
define( 'SERVETECH_DP_FILE', __FILE__ );
define( 'SERVETECH_DP_PATH', plugin_dir_path( SERVETECH_DP_FILE ) );
define( 'SERVETECH_DP_URL', plugin_dir_url( SERVETECH_DP_FILE ) );
define( 'SERVETECH_DP_INC', SERVETECH_DP_PATH . 'includes/' );

// Autoloader (PSR-4 style simple)
spl_autoload_register( function( $class ) {
    $prefix = 'SERVETECH_DP\\';
    $base_dir = SERVETECH_DP_INC;
    $len = strlen( $prefix );
    if ( strncmp( $prefix, $class, $len ) !== 0 ) {
        return;
    }
    $relative_class = substr( $class, $len );
    $file = $base_dir . str_replace( '\\', '/', $relative_class ) . '.php';
    if ( file_exists( $file ) ) {
        require $file;
    }
} );

// Bootstrap
function servetech_dp_init() {
    // Wait until plugins_loaded to ensure WooCommerce is loaded
    if ( class_exists( 'WooCommerce' ) || defined( 'WC_PLUGIN_FILE' ) ) {
        $plugin = new \SERVETECH_DP\Plugin();
        $plugin->run();
    } else {
        add_action( 'admin_notices', function() {
            echo '<div class="notice notice-warning"><p><strong>SERVETECH Donation Popup:</strong> WooCommerce is not active. Please activate WooCommerce.</p></div>';
        } );
    }
}
add_action( 'plugins_loaded', 'servetech_dp_init' );
