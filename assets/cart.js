(function () {
  const selectors = {
    page: '[data-cart-page]',
    form: '[data-cart-form]',
    items: '[data-cart-items]',
    item: '[data-cart-item]',
    empty: '[data-cart-empty]',
    footer: '[data-cart-footer]',
    status: '[data-cart-status]',
    subtotal: '[data-cart-subtotal]',
    checkout: '[data-cart-checkout]',
    count: '[data-cart-count]',
    quantityInput: '[data-cart-quantity-input]',
    quantityMinus: '[data-cart-quantity-minus]',
    quantityPlus: '[data-cart-quantity-plus]',
    remove: '[data-cart-remove]',
    linePrice: '[data-cart-item-line-price]'
  };

  class ForeFunnyCart {
    constructor(root) {
      this.root = root;
      this.form = document.querySelector(selectors.form);
      this.itemsContainer = document.querySelector(selectors.items);
      this.emptyState = document.querySelector(selectors.empty);
      this.footer = document.querySelector(selectors.footer);
      this.status = document.querySelector(selectors.status);
      this.debounceTimers = new Map();
      this.pendingRequests = new Map();

      this.bindEvents();
    }

    bindEvents() {
      document.addEventListener('click', (event) => {
        const minus = event.target.closest(selectors.quantityMinus);
        const plus = event.target.closest(selectors.quantityPlus);
        const remove = event.target.closest(selectors.remove);

        if (minus || plus || remove) {
          event.preventDefault();
        }

        if (minus) this.changeByButton(minus, -1);
        if (plus) this.changeByButton(plus, 1);
        if (remove) this.removeItem(remove);
      });

      document.addEventListener('change', (event) => {
        if (!event.target.matches(selectors.quantityInput)) return;
        this.changeByInput(event.target);
      });

      document.addEventListener('keydown', (event) => {
        if (!event.target.matches(selectors.quantityInput) || event.key !== 'Enter') return;
        event.preventDefault();
        event.target.blur();
      });
    }

    changeByButton(button, delta) {
      const row = button.closest(selectors.item);
      const input = row ? row.querySelector(selectors.quantityInput) : null;
      if (!row || !input) return;

      const nextQuantity = Math.max(0, this.getInputQuantity(input) + delta);
      input.value = nextQuantity;
      this.queueChange(row, nextQuantity);
    }

    changeByInput(input) {
      const row = input.closest(selectors.item);
      if (!row) return;

      const nextQuantity = Math.max(0, this.getInputQuantity(input));
      input.value = nextQuantity;
      this.queueChange(row, nextQuantity);
    }

    removeItem(button) {
      const row = button.closest(selectors.item);
      if (!row) return;
      this.queueChange(row, 0, true);
    }

    getInputQuantity(input) {
      if (String(input.value).trim() === '') return 1;
      const quantity = parseInt(input.value, 10);
      return Number.isFinite(quantity) ? quantity : 0;
    }

    queueChange(row, quantity, immediate = false) {
      const key = row.dataset.cartItemKey;
      if (!key) return;

      window.clearTimeout(this.debounceTimers.get(key));

      const update = () => this.updateLine(row, key, quantity);
      if (immediate) {
        update();
      } else {
        this.debounceTimers.set(key, window.setTimeout(update, 300));
      }
    }

    updateLine(row, key, quantity) {
      const previousRequest = this.pendingRequests.get(key);
      if (previousRequest) previousRequest.abort();

      const controller = new AbortController();
      this.pendingRequests.set(key, controller);
      this.setRowLoading(row, true);
      this.setCheckoutLoading(true);
      this.setStatus('Updating cart...');

      fetch(`${window.Shopify && Shopify.routes ? Shopify.routes.root : '/'}cart/change.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          id: key,
          quantity
        }),
        signal: controller.signal
      })
        .then((response) => {
          if (!response.ok) throw new Error('Unable to update cart');
          return response.json();
        })
        .then((cart) => {
          this.pendingRequests.delete(key);
          this.renderCart(cart);
          this.setStatus('Cart updated.');
          document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart } }));
        })
        .catch((error) => {
          if (error.name === 'AbortError') return;
          this.pendingRequests.delete(key);
          this.setRowLoading(row, false);
          this.setCheckoutLoading(false);
          this.setStatus('We could not update your cart. Please try again.', true);
          this.restoreCartFromServer();
        });
    }

    restoreCartFromServer() {
      fetch(`${window.Shopify && Shopify.routes ? Shopify.routes.root : '/'}cart.js`, {
        headers: { Accept: 'application/json' }
      })
        .then((response) => response.json())
        .then((cart) => this.renderCart(cart))
        .catch(() => {});
    }

    renderCart(cart) {
      const cartItems = Array.isArray(cart.items) ? cart.items : [];
      const itemByKey = new Map(cartItems.map((item) => [item.key, item]));

      document.querySelectorAll(selectors.item).forEach((row) => {
        const item = itemByKey.get(row.dataset.cartItemKey);
        if (!item) {
          row.remove();
          return;
        }

        const input = row.querySelector(selectors.quantityInput);
        const minus = row.querySelector(selectors.quantityMinus);
        const prices = row.querySelectorAll(selectors.linePrice);

        if (input) input.value = item.quantity;
        if (minus) minus.disabled = item.quantity <= 1;
        prices.forEach((price) => {
          price.textContent = this.formatMoney(item.final_line_price, cart.currency);
        });

        this.setRowLoading(row, false);
      });

      this.updateCartChrome(cart);
      this.reindexInputs();
      this.setCheckoutLoading(false);
    }

    updateCartChrome(cart) {
      const hasItems = cart.item_count > 0;

      document.querySelectorAll(selectors.count).forEach((count) => {
        count.textContent = cart.item_count;
      });

      document.querySelectorAll('[data-fore-funny-cart-link]').forEach((link) => {
        const itemLabel = cart.item_count === 1 ? 'item' : 'items';
        link.setAttribute('aria-label', `View cart, ${cart.item_count} ${itemLabel}`);
      });

      document.querySelectorAll(selectors.subtotal).forEach((subtotal) => {
        subtotal.textContent = this.formatMoney(cart.total_price, cart.currency);
      });

      document.querySelectorAll(selectors.checkout).forEach((button) => {
        button.disabled = !hasItems;
      });

      this.toggleElement(this.form, hasItems);
      this.toggleElement(this.footer, hasItems);
      this.toggleElement(this.emptyState, !hasItems);
    }

    reindexInputs() {
      document.querySelectorAll(selectors.quantityInput).forEach((input, index) => {
        input.dataset.line = String(index + 1);
      });
    }

    setRowLoading(row, loading) {
      if (!row) return;
      row.classList.toggle('is-updating', loading);
      row.setAttribute('aria-busy', loading ? 'true' : 'false');
      row.querySelectorAll('button, input').forEach((control) => {
        if (loading) {
          control.dataset.wasDisabled = control.disabled ? 'true' : 'false';
          control.disabled = true;
        } else if (control.dataset.wasDisabled !== 'true') {
          control.disabled = false;
          delete control.dataset.wasDisabled;
        }
      });

      if (!loading) {
        const input = row.querySelector(selectors.quantityInput);
        const minus = row.querySelector(selectors.quantityMinus);
        if (input && minus) minus.disabled = this.getInputQuantity(input) <= 1;
      }
    }

    toggleElement(element, show) {
      if (!element) return;
      element.hidden = !show;
      element.classList.toggle('is-hidden', !show);
    }

    setCheckoutLoading(loading) {
      document.querySelectorAll(selectors.checkout).forEach((button) => {
        button.disabled = loading || button.closest('[hidden]') !== null;
      });
    }

    setStatus(message, isError = false) {
      if (!this.status) return;
      this.status.textContent = message;
      this.status.classList.toggle('is-error', isError);
    }

    formatMoney(cents, currency) {
      const amount = Number(cents || 0) / 100;
      const currencyCode = currency || 'AUD';

      if (currencyCode === 'AUD') {
        return `$${amount.toFixed(2)} AUD`;
      }

      try {
        return new Intl.NumberFormat(document.documentElement.lang || 'en', {
          style: 'currency',
          currency: currencyCode
        }).format(amount);
      } catch (error) {
        return `$${amount.toFixed(2)}`;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const cartPage = document.querySelector(selectors.page);
    if (cartPage) new ForeFunnyCart(cartPage);
  });
})();
