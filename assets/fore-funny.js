const packPrices = { 10: 5.40, 50: 26.00, 100: 47.00, 500: 200.00 };
let selectedPack = 50;

function getForeFunnyData() {
  const dataEl = document.getElementById('ForeFunnyProductData');
  if (!dataEl) return { variants: [] };

  try {
    return JSON.parse(dataEl.textContent);
  } catch (error) {
    return { variants: [] };
  }
}

function getPackFromTitle(title) {
  const match = String(title || '').match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function formatForeFunnyMoney(cents) {
  return `$${(Number(cents) / 100).toFixed(2)} AUD`;
}

function getSelectedVariant() {
  const selectedOption = document.querySelector('.pack-option.selected');

  const variantId = selectedOption ? selectedOption.dataset.variantId : null;
  const data = getForeFunnyData();
  return data.variants.find((variant) => String(variant.id) === String(variantId)) || null;
}

function getSelectedPackLabel() {
  const selectedOption = document.querySelector('.pack-option.selected');
  const packQty = selectedOption ? selectedOption.querySelector('.pack-qty') : null;
  return packQty ? packQty.textContent.trim() : `×${selectedPack}`;
}

function updateForeFunnyButtons(variant) {
  const selectedOption = document.querySelector('.pack-option.selected');
  const fallbackPrice = selectedOption && selectedOption.dataset.price ? `${selectedOption.dataset.price} AUD` : '$26.00 AUD';
  const price = variant ? formatForeFunnyMoney(variant.price) : fallbackPrice;
  const packLabel = getSelectedPackLabel();
  const mainAtc = document.getElementById('mainAtc');
  const stickyText = document.querySelector('.sticky-atc-text');
  const variantSelect = document.querySelector('.fore-funny-variant-select');
  const stickyButton = document.querySelector('.sticky-atc-btn');

  if (mainAtc) {
    mainAtc.textContent = `Add to Cart — ${price}`;
    mainAtc.disabled = false;
  }

  if (stickyText) {
    stickyText.innerHTML = `Fore & Funny™ Golf Tees — <strong>Pack ${packLabel} desde ${price}</strong>`;
  }

  if (variantSelect && variant) {
    variantSelect.value = variant.id;
    variantSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (stickyButton) {
    stickyButton.disabled = false;
    stickyButton.textContent = 'Add to Cart';
  }
}

function selectVariant(el) {
  document.querySelectorAll('.pack-option').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');

  const variantId = el.dataset.variantId;
  const price = el.dataset.price;

  // Update hidden variant input for cart
  const idInput = document.querySelector('[name="id"]');
  if (idInput) idInput.value = variantId;

  // Update Add to Cart button
  const atcBtn = document.getElementById('mainAtc');
  if (atcBtn) atcBtn.textContent = 'Add to Cart — ' + price + ' AUD';

  // Update sticky bar
  const stickyStrong = document.querySelector('.sticky-atc-text strong');
  if (stickyStrong) stickyStrong.textContent = price + ' AUD';

  // Fetch variant data and update image
  fetch('/variants/' + variantId + '.js')
    .then(r => r.json())
    .then(variant => {
      if (variant.featured_image && variant.featured_image.src) {
        const mainImg = document.querySelector('.main-image img');
        if (mainImg) {
          mainImg.src = variant.featured_image.src;
          mainImg.style.transition = 'opacity 0.3s';
          mainImg.style.opacity = '0';
          setTimeout(() => mainImg.style.opacity = '1', 50);
        }
      }
    });
}

function selectPack(el) {
  selectVariant(el);
}

function toggleFaq(btn) {
  const item = btn.parentElement;
  const isOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(i => i.classList.remove('open'));
  if (!isOpen) item.classList.add('open');
}

function updateForeFunnyCartCount(count) {
  const cartLink = document.querySelector('[data-fore-funny-cart-link]');
  if (cartLink && Number.isInteger(count)) {
    cartLink.textContent = `🛒 Cart (${count})`;
  }
}

function addSelectedForeFunnyVariant() {
  const variant = getSelectedVariant();
  const stickyButton = document.querySelector('.sticky-atc-btn');
  if (!variant) return;

  if (stickyButton) {
    stickyButton.disabled = true;
    stickyButton.textContent = 'Adding...';
  }

  fetch('/cart/add.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      id: variant.id,
      quantity: 1
    })
  })
    .then((response) => {
      if (!response.ok) throw new Error('Unable to add item to cart');
      return fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
    })
    .then((response) => response.json())
    .then((cart) => {
      updateForeFunnyCartCount(cart.item_count);
      if (stickyButton) stickyButton.textContent = 'Added!';
      setTimeout(() => {
        if (stickyButton) {
          stickyButton.disabled = false;
          stickyButton.textContent = 'Add to Cart';
        }
      }, 1200);
    })
    .catch(() => {
      if (stickyButton) {
        stickyButton.disabled = false;
        stickyButton.textContent = 'Try Again';
      }
    });
}

document.addEventListener('DOMContentLoaded', () => {
  const stickyAtc = document.getElementById('stickyAtc');
  const productSection = document.getElementById('product');
  const stickyButton = document.querySelector('.sticky-atc-btn');
  const selectedOption = document.querySelector('.pack-option.selected');

  const count = Math.floor(Math.random() * 15) + 18;
  const el = document.getElementById('viewerCount');
  if (el) el.textContent = count + ' people are viewing this right now';

  if (selectedOption) {
    selectVariant(selectedOption);
  }

  if (stickyButton) {
    stickyButton.addEventListener('click', addSelectedForeFunnyVariant);
  }

  window.addEventListener('scroll', () => {
    const hero = document.querySelector('.hero');
    if (!stickyAtc || !hero) return;
    const heroH = hero.offsetHeight;
    stickyAtc.classList.toggle('visible', window.scrollY > heroH + 200);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  if (productSection) {
    productSection.addEventListener('submit', (event) => {
      const form = event.target;
      if (!form.matches('form[action*="/cart/add"]')) return;
    });
  }
});
