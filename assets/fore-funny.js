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

function updateForeFunnyButtons(variant, pack) {
  const price = variant ? formatForeFunnyMoney(variant.price) : `$${packPrices[pack].toFixed(2)} AUD`;
  const mainAtc = document.getElementById('mainAtc');
  const stickyText = document.querySelector('.sticky-atc-text');
  const variantSelect = document.querySelector('.fore-funny-variant-select');
  const stickyButton = document.querySelector('.sticky-atc-btn');

  if (mainAtc) {
    mainAtc.textContent = `🛒 Add to Cart — ${price}`;
    mainAtc.disabled = Boolean(variant && !variant.available);
    if (variant && !variant.available) mainAtc.textContent = `Sold Out — ${price}`;
  }

  if (stickyText) {
    stickyText.innerHTML = `Fore & Funny™ Golf Tees — <strong>Pack ×${pack} desde ${price}</strong>`;
  }

  if (variantSelect && variant) {
    variantSelect.value = variant.id;
    variantSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (stickyButton) {
    stickyButton.disabled = Boolean(variant && !variant.available);
    stickyButton.textContent = variant && !variant.available ? 'Sold Out' : 'Add to Cart';
  }
}

function selectPack(el) {
  document.querySelectorAll('.pack-option').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  selectedPack = parseInt(el.dataset.pack, 10);
  const variant = getSelectedVariant();
  updateForeFunnyButtons(variant, selectedPack);
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
  if (!variant || !variant.available) return;

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

  if (selectedOption) {
    selectedPack = parseInt(selectedOption.dataset.pack, 10);
    updateForeFunnyButtons(getSelectedVariant(), selectedPack);
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
      if (!form.matches('.fore-funny-product-form')) return;
      const variant = getSelectedVariant();
      if (!variant || variant.available) return;
      event.preventDefault();
    });
  }
});
