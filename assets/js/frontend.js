(function($) {
    $(document).ready(function() {

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

        // Open / Close Modal
        function openModal() {
            $modal.show();
        }

        function closeModal() {
            chosenSku = '';
            $modal.find('.servetech-dp-tile').removeClass('active');
            $modal.hide();
            $modal.find('.servetech-dp-proceed').attr('disabled', true);
        }

        // Tile selection
        $modal.on('click', '.servetech-dp-tile', function(e) {
            e.preventDefault();
            $modal.find('.servetech-dp-tile').removeClass('active');
            $(this).addClass('active');
            chosenSku = $(this).data('sku');
            $modal.find('.servetech-dp-proceed').attr('disabled', false);
        });

        // Close / Skip
        $modal.on('click', '.servetech-dp-close, .servetech-dp-skip, .servetech-dp-overlay', function(e) {
            e.preventDefault();
            closeModal();
            if ($(this).hasClass('servetech-dp-skip') && window.__servetech_dp_on_skip) {
                window.__servetech_dp_on_skip();
            }
        });

        // Proceed: Add main product + donation
        $modal.on('click', '.servetech-dp-proceed', function(e) {
            e.preventDefault();
            if (!window.__servetech_dp_pending) return;

            var data = {
                action: 'servetech_add_to_cart_with_donation',
                nonce: SERVETECH_DP.nonce,
                product_id: window.__servetech_dp_pending.product_id,
                quantity: window.__servetech_dp_pending.quantity || 1,
                donation_sku: chosenSku
            };

            // CRITICAL: Send variation data if exists
            if (window.__servetech_dp_pending.variation_id) {
                data.variation_id = window.__servetech_dp_pending.variation_id;
                data.variation = window.__servetech_dp_pending.variation;
            }

            $.post(SERVETECH_DP.ajax_url, data, function(resp) {
                if (resp && resp.success) {
                    window.location = SERVETECH_DP.cart_url;
                } else {
                    console.error('Add to cart failed', resp);
                    if (window.__servetech_dp_on_skip) window.__servetech_dp_on_skip();
                }
            }).fail(function() {
                if (window.__servetech_dp_on_skip) window.__servetech_dp_on_skip();
            });
        });

        // ----------------------------------------------------
        // 1. Build cart data from form (simple or variable)
        function buildCartData($form) {
            var data = {
                product_id: $form.find('input[name="add-to-cart"]').val(),
                quantity: $form.find('input[name="quantity"]').val() || 1
            };

            var variation_id = $form.find('input[name="variation_id"]').val();
            // FIX: Only include if variation_id is valid and not empty
            if (variation_id && variation_id !== '') {
                data.variation_id = variation_id;
                data.variation = {};
                $form.find('select[name^="attribute_"], input[name^="attribute_"]').each(function() {
                    var name = this.name.replace(/^attribute_/, '');
                    data.variation[name] = $(this).val();
                });
            }

            return data;
        }

        // ----------------------------------------------------
        // 2. Intercept event and show modal
        function interceptEvent(e, $el, cartData) {
            e.preventDefault();

            // Prevent double submission
            if ($el.data('servetech-submitted')) return;
            $el.data('servetech-submitted', true);

            window.__servetech_dp_pending = cartData;

            window.__servetech_dp_on_skip = function() {
                if ($el.is('form')) {
                    $el.off('submit').submit();
                    return;
                }
                if ($el.is('a') && $el.attr('href')) {
                    window.location = $el.attr('href');
                    return;
                }
                $.post(SERVETECH_DP.ajax_url, {
                    action: 'woocommerce_ajax_add_to_cart',
                    product_id: cartData.product_id,
                    quantity: cartData.quantity
                }).always(function() {
                    window.location = SERVETECH_DP.cart_url;
                });
            };

            openModal();
        }

        // ----------------------------------------------------
        // 3. Archive / Loop buttons (simple + variable support)
        $(document).on('click', 'a.add_to_cart_button, .product .button.add_to_cart_button', function(e) {
            var $el = $(this);

            // Try to get variation_id (some themes add it after selection)
            var variation_id = $el.attr('data-variation_id') || $el.data('variation_id');
            var product_id = $el.data('product_id') || $el.attr('data-product_id');

            if (!product_id) {
                var hrefMatch = $el.attr('href') ? $el.attr('href').match(/add-to-cart=(\d+)/) : null;
                product_id = hrefMatch ? hrefMatch[1] : null;
            }

            if (!product_id) return;

            var cartData = {
                product_id: product_id,
                quantity: $el.attr('data-quantity') || 1
            };

            // If variation is pre-selected in loop
            if (variation_id && variation_id !== '') {
                cartData.variation_id = variation_id;
                cartData.variation = {};

                // Try to extract attributes from button data or hidden fields
                var $container = $el.closest('.product');
                $container.find('select[name^="attribute_"], input[name^="attribute_"]').each(function() {
                    var name = this.name.replace(/^attribute_/, '');
                    cartData.variation[name] = $(this).val();
                });
            }

            interceptEvent(e, $el, cartData);
        });

        // ----------------------------------------------------
        // 4. Single product form submit (simple or variable)
        $(document).on('submit', 'form.cart', function(e) {
            var $form = $(this);

            // Prevent double handling
            if ($form.data('servetech-submitted')) return;

            var cartData = buildCartData($form);
            if (!cartData.product_id) return;

            interceptEvent(e, $form, cartData);
        });

    });
})(jQuery);