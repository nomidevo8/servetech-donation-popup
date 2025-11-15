(function($){
    $(document).ready(function(){

        // Build modal HTML once
        var modalHTML = '\
        <div id="servetech-dp-modal" class="servetech-dp-modal" style="display:none;">\
            <div class="servetech-dp-overlay"></div>\
            <div class="servetech-dp-dialog">\
                <button class="servetech-dp-close" aria-label="close">&times;</button>\
                <h3>Add a donation?</h3>\
                <p>Select an amount to add an extra donation to your cart. Or skip.</p>\
                <div class="servetech-dp-tiles">\
                    <button class="servetech-dp-tile" data-sku="servetech-don-5">5</button>\
                    <button class="servetech-dp-tile" data-sku="servetech-don-10">10</button>\
                    <button class="servetech-dp-tile" data-sku="servetech-don-15">15</button>\
                </div>\
                <div class="servetech-dp-actions">\
                    <button class="servetech-dp-skip button">Skip</button>\
                    <button class="servetech-dp-proceed button button-primary" disabled>Proceed</button>\
                </div>\
            </div>\
        </div>';

        $('body').append(modalHTML);

        var $modal = $('#servetech-dp-modal');
        var chosenSku = '';

        // open modal function
        function openModal() {
            $modal.show();
        }
        function closeModal() {
            chosenSku = '';
            $modal.find('.servetech-dp-tile').removeClass('active');
            $modal.hide();
            $modal.find('.servetech-dp-proceed').attr('disabled', true);
        }

        // tile selection
        $modal.on('click', '.servetech-dp-tile', function(e){
            e.preventDefault();
            $modal.find('.servetech-dp-tile').removeClass('active');
            $(this).addClass('active');
            chosenSku = $(this).data('sku');
            $modal.find('.servetech-dp-proceed').attr('disabled', false);
        });

        $modal.on('click', '.servetech-dp-close, .servetech-dp-skip, .servetech-dp-overlay', function(e){
            e.preventDefault();
            closeModal();
            // If skip, we will proceed to add main product without donation.
            if ($(this).hasClass('servetech-dp-skip')) {
                // trigger the stored add action
                if ( window.__servetech_dp_on_skip ) {
                    window.__servetech_dp_on_skip();
                }
            }
        });

        // proceed click -> call ajax to add both
        $modal.on('click', '.servetech-dp-proceed', function(e){
            e.preventDefault();
            // call ajax with product id stored
            if ( ! window.__servetech_dp_pending ) return;
            var data = {
                action: 'servetech_add_to_cart_with_donation',
                nonce: SERVETECH_DP.nonce,
                product_id: window.__servetech_dp_pending.product_id,
                quantity: window.__servetech_dp_pending.quantity || 1,
                donation_sku: chosenSku
            };
            $.post(SERVETECH_DP.ajax_url, data, function(resp){
                if ( resp && resp.success ) {
                    window.location = SERVETECH_DP.cart_url;
                } else {
                    // fallback: try to submit original add-to-cart
                    console.error('Add to cart failed', resp);
                    if ( window.__servetech_dp_on_skip ) window.__servetech_dp_on_skip();
                }
            }).fail(function(){
                if ( window.__servetech_dp_on_skip ) window.__servetech_dp_on_skip();
            });
        });

        // intercept add to cart links and buttons
        function interceptEvent(e, $el, product_id, quantity){
            e.preventDefault();
            // store pending
            window.__servetech_dp_pending = { product_id: product_id, quantity: quantity };
            // define fallback: add only main product via native link/button
            window.__servetech_dp_on_skip = function(){
                // try to follow href if present (for archive add-to-cart links)
                if ( $el.is('a') && $el.attr('href') ) {
                    window.location = $el.attr('href');
                    return;
                }
                // else try to perform native button click or ajax add
                var native = $el.data('product_id') || product_id;
                var qty = quantity || 1;
                // attempt WooCommerce ajax add-to-cart fallback
                $.post(SERVETECH_DP.ajax_url, {
                    action: 'woocommerce_ajax_add_to_cart',
                    product_id: native,
                    quantity: qty
                }, function(){ window.location = SERVETECH_DP.cart_url; })
                .fail(function(){ window.location = SERVETECH_DP.cart_url; });
            };

            openModal();
        }

        // general delegated click handler
        $(document).on('click', 'a.add_to_cart_button, button.single_add_to_cart_button, .product .button.add_to_cart_button', function(e){
            var $el = $(this);
            var product_id = $el.data('product_id') || $el.attr('data-product_id') || ($el.attr('href') && ($el.attr('href').match(/add-to-cart=(\d+)/) || [])[1]);
            if ( ! product_id ) {
                // try to find form input
                product_id = $('form.cart').find('input[name="add-to-cart"]').val();
            }
            var quantity = $('form.cart').find('input[name="quantity"]').val() || 1;
            if ( product_id ) {
                interceptEvent(e, $el, product_id, quantity);
            }
        });

        // also intercept submit of single product form
        $(document).on('submit', 'form.cart', function(e){
            var $form = $(this);
            var product_id = $form.find('input[name="add-to-cart"]').val();
            var quantity = $form.find('input[name="quantity"]').val() || 1;
            if ( product_id ) {
                // When form is submitted, pass the form element as $el so fallback can use it
                interceptEvent(e, $form, product_id, quantity);
            }
        });

    });
})(jQuery);
