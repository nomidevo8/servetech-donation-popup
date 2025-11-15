<?php
/**
 * Admin Settings for SERVETECH Donation Popup
 */
namespace SERVETECH_DP\Admin;

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class Settings {

    private $plugin;

    public function __construct( $plugin ) {
        $this->plugin = $plugin;
    }

    public function init() {
        add_action( 'admin_menu', [ $this, 'add_settings_page' ] );
        add_action( 'admin_init', [ $this, 'register_settings' ] );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_media' ] );
    }

    public function add_settings_page() {
        add_submenu_page(
            'woocommerce',
            'Donation Popup Settings',
            'Donation Popup',
            'manage_woocommerce',
            'servetech-dp-settings',
            [ $this, 'render_page' ]
        );
    }

    public function register_settings() {
        register_setting( 'servetech_dp_settings', 'servetech_dp_popup_image' );
        register_setting( 'servetech_dp_settings', 'servetech_dp_logo_url' );

        add_settings_section( 'servetech_dp_main', '', '__return_false', 'servetech-dp-settings' );

        add_settings_field(
            'popup_image',
            'Popup Image',
            [ $this, 'field_popup_image' ],
            'servetech-dp-settings',
            'servetech_dp_main'
        );

        add_settings_field(
            'logo_url',
            'Foundation Logo',
            [ $this, 'field_logo_url' ],
            'servetech-dp-settings',
            'servetech_dp_main'
        );
    }

    public function field_popup_image() {
        $value = get_option( 'servetech_dp_popup_image', '' );
        ?>
        <input type="text" name="servetech_dp_popup_image" value="<?php echo esc_attr( $value ); ?>" class="regular-text" id="servetech_dp_popup_image" />
        <button class="button servetech-dp-upload" data-target="servetech_dp_popup_image">Upload Image</button>
        <p class="description">Recommended: 400×500 px</p>
        <?php if ( $value ): ?>
            <p><img src="<?php echo esc_url( $value ); ?>" style="max-height:80px; margin-top:8px;" /></p>
        <?php endif; ?>
        <?php
    }

    public function field_logo_url() {
        $value = get_option( 'servetech_dp_logo_url', '' );
        ?>
        <input type="text" name="servetech_dp_logo_url" value="<?php echo esc_attr( $value ); ?>" class="regular-text" id="servetech_dp_logo_url" />
        <button class="button servetech-dp-upload" data-target="servetech_dp_logo_url">Upload Logo</button>
        <p class="description">Recommended: 200×60 px</p>
        <?php if ( $value ): ?>
            <p><img src="<?php echo esc_url( $value ); ?>" style="max-height:50px; margin-top:8px;" /></p>
        <?php endif; ?>
        <?php
    }

    public function render_page() {
        ?>
        <div class="wrap">
            <h1>Donation Popup Settings</h1>
            <form method="post" action="options.php">
                <?php
                settings_fields( 'servetech_dp_settings' );
                do_settings_sections( 'servetech-dp-settings' );
                submit_button();
                ?>
            </form>
        </div>
        <?php
    }

    public function enqueue_media( $hook ) {
        if ( $hook !== 'woocommerce_page_servetech-dp-settings' ) return;

        wp_enqueue_media();

        wp_add_inline_script( 'jquery', "
        jQuery(function($){
            $('.servetech-dp-upload').on('click', function(e){
                e.preventDefault();
                var btn = $(this);
                var input = $('#' + btn.data('target'));
                var frame = wp.media({
                    title: 'Select Image',
                    button: { text: 'Use this image' },
                    multiple: false
                });
                frame.on('select', function(){
                    var attachment = frame.state().get('selection').first().toJSON();
                    input.val(attachment.url);
                });
                frame.open();
            });
        });
        " );
    }

    // Helper: Get image URLs
    public function get_popup_image() {
        return get_option( 'servetech_dp_popup_image', SERVETECH_DP_URL . 'assets/img/default-bouquet.jpg' );
    }

    public function get_logo_url() {
        return get_option( 'servetech_dp_logo_url', SERVETECH_DP_URL . 'assets/img/foundation-logo.png' );
    }
}