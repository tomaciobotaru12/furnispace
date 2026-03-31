/* FurniSpace – Main JS */

document.addEventListener('DOMContentLoaded', () => {

  // ---- AOS init ----
  if (typeof AOS !== 'undefined') {
    AOS.init({ duration: 600, once: true, offset: 60 });
  }

  // ---- Header scroll shadow ----
  const header = document.getElementById('site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
  }

  // ---- Account dropdown ----
  const accountBtn = document.getElementById('account-menu-btn');
  const accountDrop = document.getElementById('account-dropdown');
  if (accountBtn && accountDrop) {
    accountBtn.addEventListener('click', e => {
      e.stopPropagation();
      accountDrop.classList.toggle('open');
    });
    document.addEventListener('click', e => {
      if (!accountBtn.contains(e.target)) accountDrop.classList.remove('open');
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') accountDrop.classList.remove('open');
    });
  }

  // ---- Mobile nav ----
  const menuBtn   = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  const backdrop  = document.getElementById('mobile-nav-backdrop');
  const closeBtn  = document.getElementById('mobile-nav-close');

  function openNav() {
    mobileNav && mobileNav.classList.add('open');
    backdrop && (backdrop.style.display = 'block');
    document.body.style.overflow = 'hidden';
  }
  function closeNav() {
    mobileNav && mobileNav.classList.remove('open');
    backdrop && (backdrop.style.display = '');
    document.body.style.overflow = '';
  }

  menuBtn  && menuBtn.addEventListener('click', openNav);
  closeBtn && closeBtn.addEventListener('click', closeNav);
  backdrop && backdrop.addEventListener('click', closeNav);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });

  // ---- Animated counters ----
  const counters = document.querySelectorAll('.counter');
  if (counters.length) {
    const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    const animateCounter = (el) => {
      const target = parseInt(el.dataset.target, 10);
      const duration = 1400;
      const start = performance.now();
      const update = (now) => {
        const p = Math.min((now - start) / duration, 1);
        el.textContent = Math.round(ease(p) * target);
        if (p < 1) requestAnimationFrame(update);
        else el.textContent = target;
      };
      requestAnimationFrame(update);
    };
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { animateCounter(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.5 });
    counters.forEach(c => io.observe(c));
  }

  // ---- Tilt cards ----
  document.querySelectorAll('.tilt-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(600px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) scale(1.02)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });

  // ---- Bundle tabs ----
  document.querySelectorAll('.bundle-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.bundle-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.bundle-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(tab.dataset.tab);
      if (panel) panel.classList.add('active');
    });
  });

  // ---- Wishlist ----
  const WISHLIST_KEY = 'furnispace_wishlist';

  function getWishlist() {
    try { return JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]'); } catch { return []; }
  }
  function saveWishlist(ids) {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(ids));
  }

  function syncWishlistCount() {
    const count = getWishlist().length;
    const el = document.getElementById('wishlist-count');
    if (!el) return;
    if (count > 0) {
      el.textContent = count;
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  }

  function syncWishlistButtons() {
    const ids = getWishlist();
    document.querySelectorAll('.wishlist-btn, .wishlist-btn-lg').forEach(btn => {
      const id = parseInt(btn.dataset.id);
      btn.classList.toggle('active', ids.includes(id));
    });
  }

  function handleWishlistToggle(btn) {
    const id = parseInt(btn.dataset.id);
    let ids = getWishlist();
    if (ids.includes(id)) {
      ids = ids.filter(i => i !== id);
    } else {
      ids.push(id);
    }
    saveWishlist(ids);
    syncWishlistCount();
    syncWishlistButtons();
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.wishlist-btn, .wishlist-btn-lg');
    if (btn) {
      e.preventDefault();
      handleWishlistToggle(btn);
    }
  });

  syncWishlistCount();
  syncWishlistButtons();

  // ---- AJAX add to cart (intercept form submit on product cards) ----
  document.addEventListener('submit', async e => {
    const form = e.target;
    if (!form.classList.contains('add-to-cart-form')) return;
    e.preventDefault();

    const data = new FormData(form);
    try {
      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: data.get('product_id'), quantity: data.get('quantity') }),
      });
      const result = await res.json();
      if (result.success) {
        // Update cart count in header
        document.querySelectorAll('.cart-count').forEach(el => el.textContent = result.cartCount);
        // Show/update cart bubble
        const bubble = document.getElementById('cart-bubble');
        if (bubble) {
          bubble.style.display = '';
          const bubbleCount = bubble.querySelector('.cart-bubble-count');
          if (bubbleCount) bubbleCount.textContent = result.cartCount;
        }
        // Flash button
        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
          const orig = btn.textContent;
          btn.textContent = '✓ Added';
          btn.style.background = '#38a169';
          btn.style.borderColor = '#38a169';
          setTimeout(() => {
            btn.textContent = orig;
            btn.style.background = '';
            btn.style.borderColor = '';
          }, 1500);
        }
      }
    } catch (err) {
      // Fall back to regular form submit
      form.submit();
    }
  });

  // ---- Newsletter form ----
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = newsletterForm.querySelector('input[name="email"]').value;
      const msgEl = document.getElementById('newsletter-msg');
      try {
        const res = await fetch('/api/newsletter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const result = await res.json();
        msgEl.textContent = result.success ? result.message : result.error;
        msgEl.style.color = result.success ? '#86efac' : '#fca5a5';
        if (result.success) newsletterForm.reset();
      } catch {
        msgEl.textContent = 'Something went wrong. Please try again.';
        msgEl.style.color = '#fca5a5';
      }
    });
  }

  // ---- Flash message auto-dismiss ----
  document.querySelectorAll('.flash').forEach(el => {
    setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, 4000);
  });

});
