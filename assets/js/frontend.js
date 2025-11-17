/* ==== servetech-dp-frontend.js ==== */
(function($) {
    $(document).ready(function() {

        /* -----------------------------------------------------------------
         * 1. Build BOTH modals (image/logo injected from PHP)
         * ----------------------------------------------------------------- */
        var modalHTML = '\
        <div id="servetech-dp-modal" class="servetech-dp-modal" style="display:none;">\
            <div class="servetech-dp-overlay"></div>\
            <div class="servetech-dp-dialog">\
                <button class="servetech-dp-close" aria-label="close">×</button>\
                <div class="servetech-dp-left"><img src="' + SERVETECH_DP.popup_image + '" alt="Bouquet" class="servetech-dp-img"></div>\
                <div class="servetech-dp-right">\
                    <h2 class="servetech-dp-title">ADD A BOUQUET FOR SOMEONE IN NEED</h2>\
                    <p class="servetech-dp-desc">Every month we provide mini bouquets … <strong>Match your flowers or a portion to someone in need.</strong></p>\
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
                    <div class="servetech-dp-logo"><img src="' + SERVETECH_DP.logo_url + '" alt="The Flowers for Dreams Foundation"></div>\
                    <p class="servetech-dp-footnote">*Note: purchase does not constitute a charitable donation.</p>\
                </div>\
            </div>\
        </div>';

        var recipientHTML = '\
        <div id="servetech-dp-recipient-modal" class="servetech-dp-modal" style="display:none;">\
            <div class="servetech-dp-overlay"></div>\
            <div class="servetech-dp-dialog servetech-dp-recipient-dialog">\
                <button class="servetech-dp-close" aria-label="close">×</button>\
                <h2 class="servetech-dp-title">Recipient Details</h2>\
                <form id="servetech-dp-recipient-form">\
                    <p><input type="text" name="recip_first_name" placeholder="Recipient First Name *" required></p>\
                    <p><input type="text" name="recip_last_name"  placeholder="Recipient Last Name *" required></p>\
                    <p><input type="email" name="recip_email"     placeholder="Recipient Email *" required></p>\
                    <p><textarea name="card_message" placeholder="Card Message (optional)"></textarea></p>\
                    <p><input type="text" name="signed_from" placeholder="Signed From (optional)"></p>\
                    <div class="servetech-dp-actions">\
                        <button type="button" class="servetech-dp-cancel">Cancel</button>\
                        <button type="submit" class="servetech-dp-submit">Add to Cart</button>\
                    </div>\
                </form>\
            </div>\
        </div>';

        $('body').append(modalHTML + recipientHTML);

        var $donationModal   = $('#servetech-dp-modal');
        var $recipientModal  = $('#servetech-dp-recipient-modal');
        var chosenSku        = '';
        var pendingCartData  = null;   // will hold main product + donation

        /* -----------------------------------------------------------------
         * 2. Helpers
         * ----------------------------------------------------------------- */
        function openModal($m)  { $m.fadeIn(250); }
        function closeModal($m) {
            $m.fadeOut(200);
            setTimeout(function(){ $m.find('input,textarea').val(''); }, 300);
        }

        /* -----------------------------------------------------------------
         * 3. Donation modal – tile selection
         * ----------------------------------------------------------------- */
        $donationModal.on('click', '.servetech-dp-tile', function(e) {
            e.preventDefault();
            $donationModal.find('.servetech-dp-tile').removeClass('active');
            $(this).addClass('active');
            chosenSku = $(this).data('sku');
            $donationModal.find('.servetech-dp-proceed').prop('disabled', false);
        });

        /* -----------------------------------------------------------------
         * 4. Donation modal – SKIP / PROCEED
         * ----------------------------------------------------------------- */
        $donationModal.on('click', '.servetech-dp-skip, .servetech-dp-proceed', function(e) {
            e.preventDefault();

            // store the chosen SKU (empty on SKIP)
            if ($(this).hasClass('servetech-dp-proceed')) {
                // user selected a tile → keep chosenSku
            } else {
                chosenSku = '';                     // SKIP
            }

            closeModal($donationModal);
            $('[data-product_id], form.cart').data('servetech-submitted', false);
            openRecipientModal();                  // ALWAYS go to recipient form
        });
        $donationModal.on('click', '.servetech-dp-close, .servetech-dp-overlay', function(e) {
            e.preventDefault();

            if ($(this).hasClass('servetech-dp-proceed')) {
            } else {
                chosenSku = '';                   
            }

            closeModal($donationModal);
            $('[data-product_id], form.cart').data('servetech-submitted', false);
        });

        /* -----------------------------------------------------------------
         * 5. Open Recipient modal (stores everything we need)
         * ----------------------------------------------------------------- */
        function openRecipientModal() {
            pendingCartData = {
                product_id   : window.__servetech_dp_pending.product_id,
                quantity     : window.__servetech_dp_pending.quantity || 1,
                variation_id : window.__servetech_dp_pending.variation_id || 0,
                variation    : window.__servetech_dp_pending.variation   || {},
                donation_sku : chosenSku
            };
            openModal($recipientModal);
        }

        /* -----------------------------------------------------------------
         * 6. Recipient modal – CANCEL
         * ----------------------------------------------------------------- */
        $recipientModal.on('click', '.servetech-dp-cancel, .servetech-dp-close, .servetech-dp-overlay', function(e) {
            e.preventDefault();
            closeModal($recipientModal);
            // Reset "submitted" flag so popup can reopen
            $('[data-product_id], form.cart').data('servetech-submitted', false);

            // fallback: normal WooCommerce add-to-cart (no donation, no recipient)
            if (window.__servetech_dp_on_skip) {
                window.__servetech_dp_on_skip();
            }
        });

        /* -----------------------------------------------------------------
         * 7. Recipient modal – SUBMIT (single AJAX call)
         * ----------------------------------------------------------------- */
        $recipientModal.on('submit', '#servetech-dp-recipient-form', function(e) {
            e.preventDefault();
            var $form   = $(this);
            var $submit = $form.find('.servetech-dp-submit');

            // collect recipient fields
            var recipient = {
                first_name   : $form.find('[name="recip_first_name"]').val().trim(),
                last_name    : $form.find('[name="recip_last_name"]').val().trim(),
                email        : $form.find('[name="recip_email"]').val().trim(),
                card_message : $form.find('[name="card_message"]').val().trim(),
                signed_from  : $form.find('[name="signed_from"]').val().trim()
            };

            // final payload – ONE AJAX request
            var payload = {
                action       : 'servetech_add_to_cart_with_recipient',
                nonce        : SERVETECH_DP.nonce,
                product_id   : pendingCartData.product_id,
                quantity     : pendingCartData.quantity,
                variation_id : pendingCartData.variation_id,
                variation    : pendingCartData.variation,
                donation_sku : pendingCartData.donation_sku,
                recipient    : recipient
            };

            $submit.prop('disabled', true).text('Adding…');

            $.post(SERVETECH_DP.ajax_url, payload)
                .done(function(resp) {
                    if (resp && resp.success) {
                        window.location = resp.data.cart_url;
                    } else {
                        alert('Something went wrong. Please try again.');
                        console.error(resp);
                    }
                })
                .fail(function() {
                    alert('Network error. Please try again.');
                })
                .always(function() {
                    $submit.prop('disabled', false).text('Add to Cart');
                });
        });

        /* -----------------------------------------------------------------
         * 8. Helper: build cart data from the original form (single product)
         * ----------------------------------------------------------------- */
        function buildCartData($form) {
            var product_id = $form.find('input[name="add-to-cart"]').val();
            if (!product_id) return null; // stop if no product_id

            var data = {
                product_id: product_id,
                quantity  : $form.find('input[name="quantity"]').val() || 1
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


        /* -----------------------------------------------------------------
         * 9. Intercept any “Add to Cart” click / form submit
         * ----------------------------------------------------------------- */
        function interceptEvent(e, $el, cartData) {
            e.preventDefault();
            if ($el.data('servetech-submitted')) return;
            $el.data('servetech-submitted', true);

            // store globally for the modals
            window.__servetech_dp_pending = cartData;
            window.__servetech_dp_on_skip = function() {
                // user cancelled everything → fallback to normal WooCommerce flow
                if ($el.is('form')) { $el.off('submit').submit(); return; }
                if ($el.is('a') && $el.attr('href')) { window.location = $el.attr('href'); return; }
                $.post(SERVETECH_DP.ajax_url, {
                    action    : 'woocommerce_ajax_add_to_cart',
                    product_id: cartData.product_id,
                    quantity  : cartData.quantity
                }).always(function(){ window.location = SERVETECH_DP.cart_url; });
            };

            openModal($donationModal);   // start the flow
        }

        // ----- Archive / Loop buttons -----
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

        // ----- Single product form (works for simple products in Elementor/ShopEngine) -----
        $(document).on('click', 'form.cart button.single_add_to_cart_button, form.cart button[type="submit"]', function(e){
            var $form = $(this).closest('form.cart');
            if ($form.data('servetech-submitted')) return;
            e.preventDefault();
            e.stopImmediatePropagation();

            var cartData = buildCartData($form);
            if (!cartData) return;

            interceptEvent(e, $form, cartData);
        });


    });
})(jQuery);