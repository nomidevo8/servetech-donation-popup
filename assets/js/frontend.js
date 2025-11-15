/* ==== servetech-dp-frontend.js ==== */
(function($) {
    $(document).ready(function() {

        // ---- 1. Build the modal (image is injected from PHP) ----
        var modalHTML = '\
        <div id="servetech-dp-modal" class="servetech-dp-modal" style="display:none;">\
            <div class="servetech-dp-overlay"></div>\
            <div class="servetech-dp-dialog">\
                <button class="servetech-dp-close" aria-label="close">×</button>\
                    <div class="servetech-dp-left">\
                        <img src="' + SERVETECH_DP.popup_image + '" alt="Bouquet" class="servetech-dp-img">\
                    </div>\
                    <div class="servetech-dp-right">\
                        <h2 class="servetech-dp-title">ADD A BOUQUET FOR SOMEONE IN NEED</h2>\
                        <p class="servetech-dp-desc">Every month we provide mini bouquets to bring smiles to the faces of our partner charities and their clients.<br>\
                        <strong>Match your flowers or a portion to someone in need.</strong></p>\
                        <p class="servetech-dp-price"><strong>$20</strong> contributes a full mini-bouquet.</p>\
                        <div class="servetech-dp-tiles">\
                            <button class="servetech-dp-tile" data-sku="servetech-don-5">$5</button>\
                            <button class="servetech-dp-tile" data-sku="servetech-don-10">$10</button>\
                            <button class="servetech-dp-tile" data-sku="servetech-don-15">$15</button>\
                        </div>\
                        <div class="servetech-dp-actions">\
                            <button class="servetech-dp-skip">SKIP</button>\
                            <button class="servetech-dp-proceed" disabled>ADD TO CART</button>\
                        </div>\
                        <div class="servetech-dp-logo">\
                            <img src="' + SERVETECH_DP.logo_url + '" alt="The Flowers for Dreams Foundation">\
                        </div>\
                        <p class="servetech-dp-footnote">*Note: purchase does not constitute a charitable donation.</p>\
                    </div>\
            </div>\
        </div>';

        $('body').append(modalHTML);
        var $modal = $('#servetech-dp-modal');
        var chosenSku = '';

        // ---- 2. Modal open / close -------------------------------------------------
        function openModal() { $modal.fadeIn(250); }
        function closeModal() {
            chosenSku = '';
            $modal.find('.servetech-dp-tile').removeClass('active');
            $modal.find('.servetech-dp-proceed').prop('disabled', true);
            $modal.fadeOut(200);
        }

        // ---- 3. Tile selection ----------------------------------------------------
        $modal.on('click', '.servetech-dp-tile', function(e) {
            e.preventDefault();
            $modal.find('.servetech-dp-tile').removeClass('active');
            $(this).addClass('active');
            chosenSku = $(this).data('sku');
            $modal.find('.servetech-dp-proceed').prop('disabled', false);
        });

        // ---- 4. Close / Skip ------------------------------------------------------
        $modal.on('click', '.servetech-dp-close, .servetech-dp-skip, .servetech-dp-overlay', function(e) {
            e.preventDefault();
            closeModal();
            if ($(this).hasClass('servetech-dp-skip') && window.__servetech_dp_on_skip) {
                window.__servetech_dp_on_skip();
            }
        });

        // ---- 5. Proceed -----------------------------------------------------------
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

        // ---- 6. Helper: build cart data from form -------------------------------
        function buildCartData($form) {
            var data = {
                product_id: $form.find('input[name="add-to-cart"]').val(),
                quantity: $form.find('input[name="quantity"]').val() || 1
            };
            var variation_id = $form.find('input[name="variation_id"]').val();
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

        // ---- 7. Intercept add-to-cart --------------------------------------------
        function interceptEvent(e, $el, cartData) {
            e.preventDefault();
            if ($el.data('servetech-submitted')) return;
            $el.data('servetech-submitted', true);

            window.__servetech_dp_pending = cartData;
            window.__servetech_dp_on_skip = function() {
                if ($el.is('form')) { $el.off('submit').submit(); return; }
                if ($el.is('a') && $el.attr('href')) { window.location = $el.attr('href'); return; }
                $.post(SERVETECH_DP.ajax_url, {
                    action: 'woocommerce_ajax_add_to_cart',
                    product_id: cartData.product_id,
                    quantity: cartData.quantity
                }).always(function() { window.location = SERVETECH_DP.cart_url; });
            };
            openModal();
        }

        // Archive / Loop buttons
        $(document).on('click', 'a.add_to_cart_button, .product .button.add_to_cart_button', function(e) {
            var $el = $(this);
            var product_id = $el.data('product_id') || $el.attr('data-product_id');
            if (!product_id) {
                var m = $el.attr('href') ? $el.attr('href').match(/add-to-cart=(\d+)/) : null;
                product_id = m ? m[1] : null;
            }
            if (!product_id) return;

            var cartData = { product_id: product_id, quantity: $el.attr('data-quantity') || 1 };
            var variation_id = $el.attr('data-variation_id') || $el.data('variation_id');
            if (variation_id) {
                cartData.variation_id = variation_id;
                cartData.variation = {};
                var $c = $el.closest('.product');
                $c.find('select[name^="attribute_"], input[name^="attribute_"]').each(function() {
                    var n = this.name.replace(/^attribute_/, '');
                    cartData.variation[n] = $(this).val();
                });
            }
            interceptEvent(e, $el, cartData);
        });

        // Single product form
        $(document).on('submit', 'form.cart', function(e) {
            var $form = $(this);
            if ($form.data('servetech-submitted')) return;
            var cartData = buildCartData($form);
            if (!cartData.product_id) return;
            interceptEvent(e, $form, cartData);
        });

    });
})(jQuery);