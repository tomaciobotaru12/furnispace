/* FurniSpace – Room Visualizer */

// Style keyword associations for product scoring
const STYLE_KEYWORDS = {
  scandinavian: ['oak', 'pine', 'birch', 'linen', 'natural', 'nordic', 'light', 'clean', 'minimal', 'beech'],
  industrial:   ['steel', 'metal', 'iron', 'black', 'mesh', 'aluminum', 'recycled', 'raw'],
  boho:         ['woven', 'seagrass', 'bamboo', 'cotton', 'rattan', 'natural', 'cord', 'ceramic'],
  classic:      ['walnut', 'mahogany', 'solid', 'traditional', 'carved', 'velvet', 'elegant'],
};

// Complementary categories for room suggestions
const ROOM_COMPLEMENTS = {
  'living-room': ['lighting', 'storage'],
  'bedroom':     ['lighting', 'storage'],
  'dining':      ['lighting', 'storage'],
  'office':      ['lighting', 'storage'],
};

let currentBundle = [];

document.addEventListener('DOMContentLoaded', () => {
  const form       = document.getElementById('visualizer-form');
  const budgetSlider = document.getElementById('budget-slider');
  const budgetLabel  = document.getElementById('budget-label');
  const resultsWrap  = document.getElementById('visualizer-results');
  const emptyWrap    = document.getElementById('visualizer-empty');
  const formWrap     = document.getElementById('visualizer-form-wrap');
  const vizError     = document.getElementById('viz-error');
  const addBundleBtn = document.getElementById('add-bundle-btn');
  const resetBtn     = document.getElementById('viz-reset-btn');
  const retryBtn     = document.getElementById('viz-retry-btn');

  // Budget slider live update
  budgetSlider && budgetSlider.addEventListener('input', () => {
    budgetLabel.textContent = parseInt(budgetSlider.value).toLocaleString('ro-RO') + ' RON';
  });

  // Form submit
  form && form.addEventListener('submit', async e => {
    e.preventDefault();
    vizError.style.display = 'none';

    const room  = form.querySelector('input[name="room"]:checked');
    const style = form.querySelector('input[name="style"]:checked');
    const eco   = form.querySelector('input[name="eco"]:checked');

    if (!room) { showError('Please select a room type.'); return; }
    if (!style) { showError('Please select a style preference.'); return; }

    const budget  = parseInt(budgetSlider.value);
    const minEco  = parseInt(eco ? eco.value : 0);

    document.getElementById('viz-btn-text').style.display = 'none';
    document.getElementById('viz-spinner').style.display = '';

    try {
      const res = await fetch(`/api/products?min_eco=${minEco}&max_price=${budget}`);
      const products = await res.json();

      const bundle = buildBundle(products, room.value, style.value, budget, minEco);
      currentBundle = bundle;

      document.getElementById('viz-btn-text').style.display = '';
      document.getElementById('viz-spinner').style.display = 'none';

      if (!bundle.length) {
        formWrap.style.display = 'none';
        emptyWrap.style.display = '';
        return;
      }

      renderResults(bundle, style.value);
    } catch (err) {
      showError('Could not load products. Please try again.');
      document.getElementById('viz-btn-text').style.display = '';
      document.getElementById('viz-spinner').style.display = 'none';
    }
  });

  // Add bundle to cart
  addBundleBtn && addBundleBtn.addEventListener('click', async () => {
    if (!currentBundle.length) return;
    addBundleBtn.disabled = true;
    addBundleBtn.textContent = 'Adding...';

    try {
      const res = await fetch('/api/cart/add-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_ids: currentBundle.map(p => p.id).join(',') }),
      });
      const result = await res.json();
      if (result.success) {
        // Update cart count
        document.querySelectorAll('.cart-count').forEach(el => el.textContent = result.cartCount);
        const bubble = document.getElementById('cart-bubble');
        if (bubble) {
          bubble.style.display = '';
          const bc = bubble.querySelector('.cart-bubble-count');
          if (bc) bc.textContent = result.cartCount;
        }
        const msgEl = document.getElementById('viz-add-msg');
        msgEl.style.display = '';
        msgEl.innerHTML = `✓ ${result.added} items added to cart! <a href="/cart" class="btn btn-primary btn-sm" style="margin-left:.75rem">View Cart</a>`;
        addBundleBtn.textContent = '✓ Added to Cart';
        addBundleBtn.style.background = '#38a169';
        addBundleBtn.style.borderColor = '#38a169';
      }
    } catch {
      addBundleBtn.disabled = false;
      addBundleBtn.textContent = 'Add All to Cart';
    }
  });

  // Reset
  function doReset() {
    formWrap.style.display = '';
    resultsWrap.style.display = 'none';
    emptyWrap.style.display = 'none';
    currentBundle = [];
    form && form.reset();
    budgetLabel.textContent = '4,999 RON';
    budgetSlider.value = 4999;
  }
  resetBtn && resetBtn.addEventListener('click', doReset);
  retryBtn && retryBtn.addEventListener('click', doReset);
});

function showError(msg) {
  const el = document.getElementById('viz-error');
  el.textContent = msg;
  el.style.display = '';
}

function scoreProduct(product, targetRoom, styleKeywords) {
  let score = 0;
  const text = [product.name, product.material || '', product.short_description || ''].join(' ').toLowerCase();

  // Room match bonus
  if (product.category_slug === targetRoom) score += 10;

  // Complementary room bonus
  const complements = ROOM_COMPLEMENTS[targetRoom] || [];
  if (complements.includes(product.category_slug)) score += 3;

  // Style keyword match
  for (const kw of styleKeywords) {
    if (text.includes(kw)) score += 2;
  }

  // Eco bonus
  if (product.eco_score >= 5) score += 4;
  else if (product.eco_score >= 4) score += 2;

  return score;
}

function buildBundle(products, room, style, budget, minEco) {
  const styleKws = STYLE_KEYWORDS[style] || [];

  // Score all products
  const scored = products.map(p => ({ ...p, score: scoreProduct(p, room, styleKws) }));
  scored.sort((a, b) => b.score - a.score);

  const bundle = [];
  const perCat = {};
  let total = 0;

  for (const p of scored) {
    const effectivePrice = p.sale_price || p.price;
    if (total + effectivePrice > budget) continue;
    if ((perCat[p.category_slug] || 0) >= 2) continue;
    if (bundle.length >= 6) break;

    bundle.push(p);
    perCat[p.category_slug] = (perCat[p.category_slug] || 0) + 1;
    total += effectivePrice;
  }

  return bundle;
}

function renderResults(bundle, style) {
  const grid    = document.getElementById('viz-products-grid');
  const totalEl = document.getElementById('bundle-total');
  const sub     = document.getElementById('viz-results-sub');
  const results = document.getElementById('visualizer-results');
  const formWrap = document.getElementById('visualizer-form-wrap');
  const addBtn  = document.getElementById('add-bundle-btn');
  const msgEl   = document.getElementById('viz-add-msg');

  grid.innerHTML = '';
  msgEl.style.display = 'none';
  addBtn.disabled = false;
  addBtn.textContent = 'Add All to Cart';
  addBtn.style.background = '';
  addBtn.style.borderColor = '';

  let total = 0;
  bundle.forEach(p => {
    const price = p.sale_price || p.price;
    total += price;
    const ecoHtml = Array.from({length:5}, (_,i) =>
      `<span class="eco-dot ${i < p.eco_score ? 'active' : ''}"></span>`
    ).join('') + '<span class="eco-label">Eco</span>';
    const priceHtml = p.sale_price
      ? `<span class="price-sale">${p.sale_price.toLocaleString('ro-RO')} RON</span> <span class="price-original">${p.price.toLocaleString('ro-RO')} RON</span>`
      : `<span class="price-regular">${p.price.toLocaleString('ro-RO')} RON</span>`;

    grid.insertAdjacentHTML('beforeend', `
      <div class="product-card">
        <div class="product-card-img-wrap">
          <a href="/product/${p.slug}">
            <img src="${p.image}" alt="${p.name}" loading="lazy">
          </a>
          ${p.sale_price ? '<span class="badge-sale">Sale</span>' : ''}
          <div class="eco-badge">${ecoHtml}</div>
        </div>
        <div class="product-card-body">
          <h3><a href="/product/${p.slug}">${p.name}</a></h3>
          <p style="font-size:.75rem;color:var(--color-muted);margin-bottom:.4rem">${p.category_name}</p>
          <div class="product-price">${priceHtml}</div>
        </div>
      </div>
    `);
  });

  totalEl.textContent = total.toLocaleString('ro-RO') + ' RON';
  sub.textContent = `${bundle.length} carefully picked pieces for your ${style} space.`;

  formWrap.style.display = 'none';
  results.style.display = '';
}
