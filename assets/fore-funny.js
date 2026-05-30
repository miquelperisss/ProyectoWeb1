(function () {
  const FREE_SHIPPING_THRESHOLD = 6000;
  const products = ['ClickSwing Pro Trainer', 'SwingBand Elite Trainer', 'ArmPlane Smart Ball', 'GripForm Corrector', 'AlignPro Swing Rods', 'WristLock Swing Brace'];
  const names = ['James', 'Mike', 'Sarah', 'Dave', 'Chris', 'Tom', 'Olivia', 'Ben', 'Emily', 'Lachlan'];
  const cities = ['Melbourne', 'Sydney', 'Brisbane', 'Perth', 'Adelaide', 'Gold Coast', 'Canberra', 'Hobart'];
  let exitIntentShown = false;
  let urgencyInterval = null;

  function money(cents) {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format((Number(cents) || 0) / 100);
  }

  function escapeHTML(value) {
    return String(value || '').replace(/[&<>'"]/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char];
    });
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function postJSON(url, payload) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      if (!response.ok) throw new Error('Shopify cart request failed');
      return response.json();
    });
  }

  function fetchCart() {
    return fetch('/cart.js', { headers: { 'Accept': 'application/json' } }).then(function (response) {
      if (!response.ok) throw new Error('Unable to fetch cart');
      return response.json();
    });
  }

  function buildCartDrawer() {
    if (document.getElementById('SwingEdgeCartDrawer')) return;
    const drawer = document.createElement('div');
    drawer.id = 'SwingEdgeCartDrawer';
    drawer.className = 'cart-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = `
      <div class="cart-drawer__overlay" data-cart-close></div>
      <aside class="cart-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="SwingEdgeCartTitle">
        <header class="cart-drawer__header">
          <h2 class="cart-drawer__title" id="SwingEdgeCartTitle">Your cart</h2>
          <button class="cart-drawer__close" type="button" aria-label="Close cart" data-cart-close>&times;</button>
        </header>
        <div class="cart-drawer__items" data-cart-items><p class="cart-drawer__empty">Loading your cart...</p></div>
        <footer class="cart-drawer__footer">
          <div class="free-shipping">
            <p class="free-shipping__text" data-free-shipping-text>Free shipping over $60 AUD</p>
            <div class="free-shipping__bar"><div class="free-shipping__fill" data-free-shipping-fill></div></div>
          </div>
          <div class="cart-drawer__subtotal"><span>Subtotal</span><strong data-cart-subtotal>${money(0)}</strong></div>
          <a class="cart-drawer__checkout" href="/checkout">Checkout</a>
          <a class="cart-drawer__continue" href="/collections/all" data-cart-close>Continue Shopping</a>
        </footer>
      </aside>`;
    document.body.appendChild(drawer);

    drawer.addEventListener('click', function (event) {
      const closeTrigger = event.target.closest('[data-cart-close]');
      if (closeTrigger) {
        event.preventDefault();
        closeCartDrawer();
        return;
      }
      const qtyButton = event.target.closest('[data-cart-qty]');
      if (qtyButton) {
        updateCartItemQty(qtyButton.dataset.variantId, Number(qtyButton.dataset.qty));
        return;
      }
      const removeButton = event.target.closest('[data-cart-remove]');
      if (removeButton) updateCartItemQty(removeButton.dataset.variantId, 0);
    });
  }

  function openCartDrawer() {
    buildCartDrawer();
    const drawer = document.getElementById('SwingEdgeCartDrawer');
    if (!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-drawer-open');
    renderCartDrawer();
  }

  function closeCartDrawer() {
    const drawer = document.getElementById('SwingEdgeCartDrawer');
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cart-drawer-open');
  }

  function renderCartDrawer() {
    buildCartDrawer();
    return fetchCart().then(function (cart) {
      const drawer = document.getElementById('SwingEdgeCartDrawer');
      const itemsEl = drawer.querySelector('[data-cart-items]');
      const subtotalEl = drawer.querySelector('[data-cart-subtotal]');
      const freeText = drawer.querySelector('[data-free-shipping-text]');
      const freeFill = drawer.querySelector('[data-free-shipping-fill]');
      updateCartCount(cart.item_count);
      subtotalEl.textContent = money(cart.total_price);
      const progress = Math.min(100, Math.round((cart.total_price / FREE_SHIPPING_THRESHOLD) * 100));
      freeFill.style.width = progress + '%';
      freeText.textContent = cart.total_price >= FREE_SHIPPING_THRESHOLD
        ? 'You have unlocked free shipping across Australia.'
        : money(FREE_SHIPPING_THRESHOLD - cart.total_price) + ' away from free shipping over $60 AUD.';

      if (!cart.items.length) {
        itemsEl.innerHTML = '<p class="cart-drawer__empty">Your cart is empty. Add a SwingEdge training aid to get started.</p>';
        return cart;
      }

      itemsEl.innerHTML = cart.items.map(function (item) {
        const title = escapeHTML(item.product_title);
        const variant = item.variant_title && item.variant_title !== 'Default Title' ? '<p class="cart-drawer__item-variant">' + escapeHTML(item.variant_title) + '</p>' : '';
        const image = item.image ? '<img src="' + escapeHTML(item.image) + '" alt="' + title + '">' : '<span>SE</span>';
        return `
          <article class="cart-drawer__item">
            <a class="cart-drawer__item-image" href="${escapeHTML(item.url)}">${image}</a>
            <div>
              <h3 class="cart-drawer__item-title">${title}</h3>
              ${variant}
              <div class="cart-drawer__item-bottom">
                <div>
                  <div class="cart-drawer__qty" aria-label="Quantity controls">
                    <button type="button" data-cart-qty data-variant-id="${item.variant_id}" data-qty="${Math.max(0, item.quantity - 1)}" aria-label="Decrease quantity">-</button>
                    <span>${item.quantity}</span>
                    <button type="button" data-cart-qty data-variant-id="${item.variant_id}" data-qty="${item.quantity + 1}" aria-label="Increase quantity">+</button>
                  </div>
                  <button class="cart-drawer__remove" type="button" data-cart-remove data-variant-id="${item.variant_id}">Remove</button>
                </div>
                <strong>${money(item.final_line_price)}</strong>
              </div>
            </div>
          </article>`;
      }).join('');
      return cart;
    }).catch(function () {
      const itemsEl = document.querySelector('#SwingEdgeCartDrawer [data-cart-items]');
      if (itemsEl) itemsEl.innerHTML = '<p class="cart-drawer__empty">Unable to load cart. Please try again.</p>';
    });
  }

  function updateCartItemQty(variantId, newQty) {
    if (!variantId && variantId !== 0) return Promise.resolve();
    return postJSON('/cart/change.js', { id: String(variantId), quantity: Math.max(0, Number(newQty) || 0) }).then(function (cart) {
      updateCartCount(cart.item_count);
      return renderCartDrawer();
    });
  }

  function updateCartCount(count) {
    const safeCount = Number(count) || 0;
    document.querySelectorAll('[data-cart-count]').forEach(function (el) { el.textContent = safeCount; });
    document.querySelectorAll('[data-fore-funny-cart-link]').forEach(function (el) {
      el.setAttribute('aria-label', 'Open cart, ' + safeCount + ' ' + (safeCount === 1 ? 'item' : 'items'));
    });
  }

  function addToCart(variantId) {
    if (!variantId) return Promise.reject(new Error('Missing variant ID'));
    return postJSON('/cart/add.js', { id: Number(variantId), quantity: 1 }).then(fetchCart).then(function (cart) {
      updateCartCount(cart.item_count);
      openCartDrawer();
      return cart;
    }).catch(function (error) {
      console.error(error);
      alert('Sorry, this item could not be added to cart. Please refresh and try again.');
    });
  }

  function selectVariant(cardEl, variantId) {
    if (!cardEl || !variantId) return;
    const scope = cardEl.matches && (cardEl.matches('.product-card') || cardEl.matches('[data-product-form]')) ? cardEl : cardEl.closest('.product-card, [data-product-form]');
    if (!scope) return;
    scope.querySelectorAll('[data-variant-id]').forEach(function (option) {
      const active = String(option.dataset.variantId) === String(variantId);
      option.classList.toggle('selected', active);
      option.classList.toggle('is-active', active);
    });
    const atc = scope.querySelector('[data-add-to-cart], .product-card__button, .atc-btn');
    if (atc) atc.dataset.variantId = variantId;
    const hiddenInput = scope.querySelector('input[name="id"]');
    if (hiddenInput) hiddenInput.value = variantId;
    const selectedOption = scope.querySelector('[data-variant-id="' + variantId + '"]');
    if (selectedOption) {
      const priceEl = scope.querySelector('[data-product-price]');
      const compareEl = scope.querySelector('[data-product-compare-price]');
      if (selectedOption.dataset.price && priceEl) priceEl.textContent = selectedOption.dataset.price;
      if (compareEl) compareEl.textContent = selectedOption.dataset.comparePrice || '';
      if (atc && selectedOption.dataset.price) atc.textContent = 'Add to Cart — ' + selectedOption.dataset.price;
    }
  }

  function startUrgencyTimer() {
    const targets = document.querySelectorAll('[data-urgency-target]');
    if (!targets.length) return;
    targets.forEach(function (target) {
      if (target.querySelector('.urgency-timer')) return;
      const timer = document.createElement('div');
      timer.className = 'urgency-timer';
      timer.innerHTML = '<span class="urgency-dot"></span><span>Offer reserved for <strong data-urgency-time></strong></span>';
      target.prepend(timer);
    });
    let remaining = randomInt(8, 23) * 60 + randomInt(0, 59);
    function tick() {
      if (remaining <= 0) remaining = randomInt(8, 23) * 60 + randomInt(0, 59);
      const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
      const seconds = String(remaining % 60).padStart(2, '0');
      document.querySelectorAll('[data-urgency-time]').forEach(function (el) { el.textContent = minutes + ':' + seconds; });
      remaining -= 1;
    }
    tick();
    clearInterval(urgencyInterval);
    urgencyInterval = setInterval(tick, 1000);
  }

  function startPurchaseNotifications() {
    const popup = document.createElement('div');
    popup.className = 'purchase-notification';
    document.body.appendChild(popup);
    function showNotification() {
      const name = names[randomInt(0, names.length - 1)];
      const city = cities[randomInt(0, cities.length - 1)];
      const product = products[randomInt(0, products.length - 1)];
      popup.innerHTML = '<strong>' + name + ' from ' + city + '</strong><br>just ordered ' + product;
      popup.classList.add('show');
      setTimeout(function () { popup.classList.remove('show'); }, 6200);
      setTimeout(showNotification, randomInt(35, 45) * 1000);
    }
    setTimeout(showNotification, 5000);
  }

  function initStockIndicator() {
    document.querySelectorAll('[data-stock-target]').forEach(function (target) {
      if (target.querySelector('.stock-indicator')) return;
      let stock = randomInt(17, 34);
      const indicator = document.createElement('div');
      indicator.className = 'stock-indicator';
      indicator.innerHTML = '<span class="stock-dot"></span><span>Only <strong data-stock-count>' + stock + '</strong> units left</span>';
      target.appendChild(indicator);
      setInterval(function () {
        if (stock > 7 && Math.random() > 0.55) {
          stock -= 1;
          const count = indicator.querySelector('[data-stock-count]');
          if (count) count.textContent = stock;
        }
      }, randomInt(42, 76) * 1000);
    });
  }

  function buildExitPopup() {
    if (document.getElementById('SwingEdgeExitPopup')) return;
    const popup = document.createElement('div');
    popup.id = 'SwingEdgeExitPopup';
    popup.className = 'exit-popup';
    popup.innerHTML = `
      <div class="exit-popup__dialog" role="dialog" aria-modal="true" aria-labelledby="SwingEdgeExitTitle">
        <header class="exit-popup__header">
          <h2 id="SwingEdgeExitTitle">Before you leave</h2>
          <button class="exit-popup__close" type="button" data-exit-close aria-label="Close discount popup">&times;</button>
        </header>
        <div class="exit-popup__body">
          <p>Take 10% off your first SwingEdge order and start training with purpose.</p>
          <div class="discount-code">SWING10</div>
          <p>Use this code at checkout.</p>
          <button class="exit-popup__no" type="button" data-exit-close>No thanks</button>
        </div>
      </div>`;
    document.body.appendChild(popup);
    popup.addEventListener('click', function (event) {
      if (event.target === popup || event.target.closest('[data-exit-close]')) closeExitPopup();
    });
  }

  function initExitIntent() {
    buildExitPopup();
    if (window.matchMedia('(pointer: fine)').matches) {
      document.addEventListener('mouseout', function (event) { if (event.clientY <= 0) showExitPopup(); });
    } else {
      setTimeout(showExitPopup, 40000);
    }
  }

  function showExitPopup() {
    if (exitIntentShown) return;
    exitIntentShown = true;
    const popup = document.getElementById('SwingEdgeExitPopup');
    if (!popup) return;
    popup.classList.add('open');
    document.body.classList.add('exit-popup-open');
  }

  function closeExitPopup() {
    const popup = document.getElementById('SwingEdgeExitPopup');
    if (!popup) return;
    popup.classList.remove('open');
    document.body.classList.remove('exit-popup-open');
  }

  function injectReviews() {
    if (document.getElementById('swingedge-reviews')) return;
    const faq = document.querySelector('.faq-section');
    if (!faq) return;
    const reviews = [
      ['James T.', 'March 2025', 'SwingBand Elite Trainer', 'Bought the arm band to fix my flying elbow and the difference was immediate. After two weeks of range sessions I stopped using it and the connected feeling stayed. Brilliant bit of kit.'],
      ['Mike R.', 'February 2025', 'AlignPro Swing Rods', 'Been playing for 15 years and never used alignment rods. These showed me I was aimed 20m right of my target every single round. Fixed my aim in one session. Wish I had these years ago.'],
      ['Sarah L.', 'April 2025', 'WristLock Swing Brace', "Bought this for my dad for Father's Day. He was sceptical but after three range sessions he was texting me about how much straighter his drives were. Ships fast too — arrived next day."],
      ['Dave K.', 'January 2025', 'ClickSwing Pro Trainer', 'The click trainer is incredible for tempo. I had no idea how rushed my transition was until this thing told me every single rep. Two weeks in and my ball striking is the best it has ever been.'],
      ['Chris M.', 'March 2025', 'ArmPlane Smart Ball', 'Started with the smart ball to fix my chicken wing. The feedback is instant — if it drops, you know immediately. My coach noticed the difference within one lesson. Highly recommend.'],
      ['Tom B.', 'May 2025', 'GripForm Corrector', 'Never held a club correctly in 10 years of playing. The GripForm sorted that in one session. My slice is almost completely gone. Best $30 I have ever spent on golf. Ships super fast.']
    ];
    const section = document.createElement('section');
    section.id = 'swingedge-reviews';
    section.className = 'reviews-section fade-in';
    section.innerHTML = '<div class="section-header"><span class="section-eyebrow">Verified results</span><h2 class="section-title">Australian golfers are improving fast.</h2><p class="section-subtitle">Real feedback from players using SwingEdge training aids at the range, at home and on course.</p></div><div class="reviews-grid">' + reviews.map(function (review) {
      return '<article class="review-card"><div class="review-card__meta"><strong>' + review[0] + '</strong><span>' + review[1] + '</span></div><div class="stars" aria-label="5 stars">★★★★★</div><div class="review-card__product">' + review[2] + '</div><blockquote>“' + review[3] + '”</blockquote></article>';
    }).join('') + '</div>';
    faq.parentNode.insertBefore(section, faq);
  }

  function toggleFaq(btn) {
    const item = btn.closest('.faq-item');
    if (!item) return;
    const container = item.parentElement;
    const isOpen = item.classList.contains('open');
    container.querySelectorAll('.faq-item.open').forEach(function (openItem) { if (openItem !== item) openItem.classList.remove('open'); });
    item.classList.toggle('open', !isOpen);
  }

  function initProductForms() {
    document.querySelectorAll('form[action*="/cart/add"]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        const variantInput = form.querySelector('[name="id"]');
        const submit = form.querySelector('[type="submit"], [name="add"]');
        const originalText = submit ? submit.textContent : '';
        if (submit) { submit.disabled = true; submit.textContent = 'Adding...'; }
        addToCart(variantInput ? variantInput.value : null).finally(function () {
          if (submit) { submit.disabled = false; submit.textContent = originalText || 'Add to Cart'; }
        });
      });
    });
    document.querySelectorAll('[data-add-to-cart]').forEach(function (button) {
      if (button.closest('form') || button.hasAttribute('onclick')) return;
      button.addEventListener('click', function () { addToCart(button.dataset.variantId); });
    });
  }

  function initGallery() {
    document.querySelectorAll('[data-gallery-thumb]').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        const main = document.querySelector('[data-main-product-image]');
        if (!main || !thumb.dataset.fullImage) return;
        const img = main.querySelector('img');
        if (img) { img.src = thumb.dataset.fullImage; img.alt = thumb.dataset.imageAlt || img.alt; }
        document.querySelectorAll('[data-gallery-thumb]').forEach(function (item) { item.classList.remove('is-active'); });
        thumb.classList.add('is-active');
      });
    });
  }

  function initScrollEffects() {
    const sticky = document.querySelector('.sticky-atc');
    const hero = document.querySelector('.hero');
    function updateSticky() {
      if (!sticky) return;
      const threshold = hero ? hero.offsetHeight * 0.72 : 420;
      sticky.classList.toggle('visible', window.scrollY > threshold);
      sticky.classList.toggle('is-visible', window.scrollY > threshold);
    }
    updateSticky();
    window.addEventListener('scroll', updateSticky, { passive: true });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
        });
      }, { threshold: 0.14 });
      document.querySelectorAll('.fade-in').forEach(function (el) { observer.observe(el); });
    } else {
      document.querySelectorAll('.fade-in').forEach(function (el) { el.classList.add('is-visible'); });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    startUrgencyTimer();
    startPurchaseNotifications();
    initStockIndicator();
    initExitIntent();
    injectReviews();
    buildCartDrawer();
    initProductForms();
    initGallery();
    initScrollEffects();
    document.querySelectorAll('[data-fore-funny-cart-link]').forEach(function (link) {
      link.addEventListener('click', function (event) { event.preventDefault(); openCartDrawer(); });
    });
    fetchCart().then(function (cart) { updateCartCount(cart.item_count); }).catch(function () {});
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') { closeCartDrawer(); closeExitPopup(); }
  });

  window.buildCartDrawer = buildCartDrawer;
  window.openCartDrawer = openCartDrawer;
  window.closeCartDrawer = closeCartDrawer;
  window.renderCartDrawer = renderCartDrawer;
  window.updateCartItemQty = updateCartItemQty;
  window.updateCartCount = updateCartCount;
  window.addToCart = addToCart;
  window.selectVariant = selectVariant;
  window.startUrgencyTimer = startUrgencyTimer;
  window.startPurchaseNotifications = startPurchaseNotifications;
  window.initStockIndicator = initStockIndicator;
  window.initExitIntent = initExitIntent;
  window.injectReviews = injectReviews;
  window.toggleFaq = toggleFaq;
})();
