SERVETECH Donation Popup
========================

This plugin intercepts Add to Cart clicks and displays a donation popup (3 preset amounts: 5, 10, 15).
If the user chooses a donation amount, the donation product is added alongside the original product and the user is redirected to the cart.

Installation:
1. Create the folder servetech-donation-popup
2. Add files as provided.
3. Zip the folder (servetech-donation-popup.zip) and upload to WordPress Plugins -> Add New -> Upload Plugin
4. Activate. The plugin will create three simple donation products with SKUs:
   - servetech-don-5
   - servetech-don-10
   - servetech-don-15

Notes:
- Requires WooCommerce active.
- You can style the modal via assets/css/style.css
- This plugin aims to be a starting point. Adjust UX or edge cases as needed.






What the plugin does

Intercepts Add to Cart clicks

Whenever a user clicks on an “Add to Cart” button in your WooCommerce store, the plugin stops the default action temporarily.

Instead of immediately adding the product to the cart, it shows a popup modal asking if the customer wants to add a donation.

Donation popup

The popup has 3 donation options: 5, 10, and 15 (you can change these later if you want).

The popup also has a Skip button if the customer doesn’t want to donate.

Adding donation product

If the user selects a donation amount and clicks “Proceed”, the plugin:

Adds the original product to the cart.

Adds the donation product corresponding to the selected amount to the cart automatically.

If the user clicks “Skip”, only the original product is added.

Donation products creation

On plugin activation, it automatically creates 3 hidden WooCommerce products:

SKU: servetech-don-5 (price $5)

SKU: servetech-don-10 (price $10)

SKU: servetech-don-15 (price $15)

These are virtual, hidden products just for donations.

Redirect to cart

After adding products (with or without donation), the user is redirected to the cart page.

OOP & autoloading

The plugin uses object-oriented programming and an autoloader, so any additional classes you add later will load automatically.

The folder structure is clean, following best practices for maintainable plugins.