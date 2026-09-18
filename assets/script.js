/* =========================================================
   AB&J Engineering Works — site behaviour
   ========================================================= */

(function () {
  "use strict";

  var SUBJECT_LABELS = {
    "general": "General Inquiry",
    "plc-scada": "RFQ: PLC Design, Programming, and Implementation",
    "monitoring": "RFQ: Real-time Data Monitoring and Management System (SCADA)",
    "load-planning": "RFQ: Load Planning, Forecasting and Optimization",
    "efficool": "RFQ: EffiCool Aircon Energy Management System",
    "smart-systems": "RFQ: SMART Systems and Home Automation",
    "smart-farming": "RFQ: SMART Farming (Hydroponics)",
    "metal-susceptibility": "RFQ: Metal Susceptibility Apparatus",
    "stirrer": "RFQ: Chemical and Magnetic Stirrer",
    "glove-box": "RFQ: Laboratory Scale Glove Box for Wet Laboratories",
    "uav-power": "RFQ: Transformerless Power Supply for Tethered UAV Applications",
    "pv-estimate": "RFQ: PV Estimate and Installation",
    "other": "Other"
  };

  /* ---------------- Contact form delivery ----------------
     Submissions POST to a hosted form service, which filters spam and
     forwards the message by email.

     The visible challenge is hCaptcha, verified server-side by the form
     service. HCAPTCHA_SITE_KEY below is the service's own shared key,
     which is what works on the free plan: they hold the matching secret,
     so they can verify the token. Our own hCaptcha pair, or Google
     reCAPTCHA, would need a paid plan there.

     Behind it sit the hidden honeypot field and the submit-timing check.

     FORM_ACCESS_KEY comes from web3forms.com: enter the destination
     address there and the key is emailed to you. Until it is filled in,
     the form falls back to opening the visitor's email app exactly as it
     behaved before, so the site keeps working.
     -------------------------------------------------------- */

  var FORM_ACCESS_KEY = "1e141031-8fe2-4562-bf92-ff5a123bdd92";
  var HCAPTCHA_SITE_KEY = "50b2fe65-b00b-4b9e-ad62-3ba471098be2";

  // A placeholder is still a truthy string, so check for it explicitly -
  // otherwise the form would POST an invalid key instead of falling back.
  function isConfigured(value) {
    return !!value && value.indexOf("PASTE_") !== 0;
  }
  var FORM_ENDPOINT = "https://api.web3forms.com/submit";

  /* ---------------- View routing (Home / Services / About / Contact / FAQ) ---------------- */

  var views = ["home", "services", "about", "contact", "faq"];

  function showView(id) {
    if (views.indexOf(id) === -1) id = "home";
    views.forEach(function (v) {
      var el = document.getElementById("view-" + v);
      if (el) el.classList.toggle("active", v === id);
    });
    document.querySelectorAll(".main-nav a[data-view]").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-view") === id);
    });
    var nav = document.querySelector(".main-nav");
    if (nav) nav.classList.remove("open");
    var toggle = document.querySelector(".nav-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function currentHashView() {
    var h = (window.location.hash || "").replace("#", "");
    return views.indexOf(h) !== -1 ? h : "home";
  }

  function initRouting() {
    if (!document.getElementById("view-home")) return; // not on index.html

    window.addEventListener("hashchange", function () {
      showView(currentHashView());
    });

    var params = new URLSearchParams(window.location.search);
    var subject = params.get("subject");

    if (subject && SUBJECT_LABELS[subject]) {
      setSubject(subject);
      showView("contact");
      // drop the ?subject= query string from the address bar without adding a history entry
      history.replaceState(null, "", window.location.pathname + "#contact");
    } else {
      showView(currentHashView());
    }
  }

  /* ---------------- Mobile nav toggle ---------------- */

  function initNavToggle() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.querySelector(".main-nav");
    if (!toggle || !nav) return;
    toggle.addEventListener("click", function () {
      var isOpen = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
  }

  /* ---------------- Request-a-Quotation prefill ---------------- */

  function setSubject(slug) {
    var select = document.getElementById("subject");
    if (select && SUBJECT_LABELS[slug]) {
      select.value = slug;
    }
  }

  function initQuoteButtons() {
    document.querySelectorAll("[data-quote]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        var slug = btn.getAttribute("data-quote");
        if (document.getElementById("view-home")) {
          // already on the main site: no reload, just switch views
          e.preventDefault();
          setSubject(slug);
          window.location.hash = "contact";
          showView("contact");
          var nameField = document.getElementById("name");
          if (nameField) nameField.focus();
        }
        // otherwise (e.g. on pv-estimate.html) let the normal href navigate,
        // it already points to index.html?subject=...#contact
      });
    });
  }

  /* ---------------- Contact form ---------------- */

  function setStatus(text, kind) {
    var status = document.getElementById("contact-status");
    if (!status) return;
    status.textContent = text || "";
    status.classList.remove("status-error", "status-ok");
    status.classList.toggle("show", !!text);
    if (text && kind) status.classList.add(kind);
  }

  function readForm() {
    return {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      phone: document.getElementById("phone").value.trim(),
      subjectSlug: document.getElementById("subject").value,
      message: document.getElementById("message").value.trim()
    };
  }

  function validate(data) {
    if (!data.name) return "Please enter your name.";
    if (!data.email || data.email.indexOf("@") < 1) return "Please enter a valid email address.";
    if (!data.message) return "Please tell us a little about what you need.";
    return null;
  }

  /* ---- Confirmation modal ---- */

  var lastFocused = null;

  function openSentModal(title, text, isError) {
    var modal = document.getElementById("sent-modal");
    if (!modal) return;
    modal.querySelector("#sent-modal-title").textContent = title;
    modal.querySelector("#sent-modal-text").textContent = text;
    modal.classList.toggle("is-error", !!isError);
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    var closeBtn = modal.querySelector("button[data-close-modal]");
    if (closeBtn) closeBtn.focus();
  }

  function closeSentModal() {
    var modal = document.getElementById("sent-modal");
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function initSentModal() {
    var modal = document.getElementById("sent-modal");
    if (!modal) return;

    modal.addEventListener("click", function (e) {
      if (e.target.hasAttribute("data-close-modal")) closeSentModal();
    });

    document.addEventListener("keydown", function (e) {
      if (modal.hidden) return;
      if (e.key === "Escape") closeSentModal();
      // keep focus inside the dialog while it is open
      if (e.key === "Tab") {
        var btn = modal.querySelector("button[data-close-modal]");
        if (btn) { e.preventDefault(); btn.focus(); }
      }
    });
  }

  // hCaptcha draws a checkbox the visitor ticks; the widget writes its
  // token into a hidden field that is posted with the form.
  function initHcaptcha() {
    // Without a backend there is nothing to verify the token, so show no
    // challenge at all rather than a checkbox that gates nothing.
    if (!isConfigured(FORM_ACCESS_KEY)) return;
    var slot = document.getElementById("captcha-slot");
    if (!slot || slot.children.length) return;

    var box = document.createElement("div");
    box.className = "h-captcha";
    box.setAttribute("data-captcha", "true");
    box.setAttribute("data-sitekey", HCAPTCHA_SITE_KEY);
    slot.appendChild(box);

    var tag = document.createElement("script");
    tag.src = "https://js.hcaptcha.com/1/api.js";
    tag.async = true;
    tag.defer = true;
    document.head.appendChild(tag);
  }

  function initContactForm() {
    var form = document.getElementById("contact-form");
    if (!form) return;

    initHcaptcha();
    var loadedAt = Date.now();

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      // Honeypot: a real person never sees this field, so anything in it
      // is a bot filling every input on the page.
      var trap = document.getElementById("company-website");
      if (trap && trap.value) return;

      // Anything submitted within a couple of seconds of load was not typed.
      if (Date.now() - loadedAt < 2000) {
        setStatus("Please take a moment to fill in the form.", "status-error");
        return;
      }

      var data = readForm();
      var problem = validate(data);
      if (problem) {
        setStatus(problem, "status-error");
        return;
      }

      var subjectText = SUBJECT_LABELS[data.subjectSlug] || "General Inquiry";

      if (!isConfigured(FORM_ACCESS_KEY)) {
        setStatus("The form is not accepting messages right now. Please try again later.", "status-error");
        return;
      }

      // An unticked box is a validation problem, so it stays inline next
      // to the form rather than opening the outcome dialog.
      var captchaField = form.querySelector('[name="h-captcha-response"]');
      var captchaToken = captchaField ? captchaField.value : "";
      if (isConfigured(HCAPTCHA_SITE_KEY) && !captchaToken) {
        setStatus("Please complete the anti-spam check below before sending.", "status-error");
        return;
      }

      var button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      setStatus("Sending your message \u2026");

      var payload = {
        access_key: FORM_ACCESS_KEY,
        subject: subjectText,
        from_name: "AB&J Engineering Works website",
        name: data.name,
        email: data.email,
        phone: data.phone || "-",
        message: data.message
      };
      if (captchaToken) payload["h-captcha-response"] = captchaToken;

      fetch(FORM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json(); })
        .then(function (result) {
          if (result && result.success) {
            form.reset();
            setStatus("", "");
            openSentModal(
              "Thank you for your inquiry",
              "We have received your message and will get back to you as soon as possible.",
              false
            );
          } else {
            openSentModal(
              "Your message was not sent",
              "Something went wrong on the way. Please try again in a moment.",
              true
            );
          }
        })
        .catch(function () {
          openSentModal(
            "Your message was not sent",
            "We could not reach the server. Please check your connection and try again.",
            true
          );
        })
        .then(function () {
          if (button) button.disabled = false;
          if (window.hcaptcha) window.hcaptcha.reset();
        });
    });
  }

  /* ---------------- PV Estimate & Installation calculator ---------------- */

  // Turnkey rates in PHP per kWp - equipment, balance of system, and
  // installation together, the way solar is normally quoted.
  var INSTALL_TYPES = {
    "residential": { label: "Residential grid-tied", low: 55000, high: 65000 },
    "commercial": { label: "Commercial grid-tied", low: 45000, high: 58000 },
    "hybrid": { label: "Hybrid, grid-tied with battery backup", low: 85000, high: 110000 }
  };

  var PANEL_WATTS = { "450": 450, "550": 550, "585": 585 };

  function formatPeso(n) {
    return "\u20b1" + Math.round(n).toLocaleString("en-PH");
  }

  function runCalculator() {
    var range = document.getElementById("kwp-range");
    if (!range) return;

    var kwp = parseFloat(range.value);
    var panelWatts = PANEL_WATTS[document.getElementById("panel-watts").value] || 585;
    var installType = INSTALL_TYPES[document.getElementById("install-type").value] || INSTALL_TYPES.residential;

    document.getElementById("kwp-value").textContent = kwp.toFixed(1) + " kWp";

    var panelCount = Math.ceil((kwp * 1000) / panelWatts);
    var roofArea = Math.round(kwp * 6); // ~6 sqm per kWp, indicative
    var dailyYieldLow = (kwp * 3.8 * 0.8).toFixed(1);
    var dailyYieldHigh = (kwp * 4.6 * 0.8).toFixed(1);
    var costLow = kwp * installType.low;
    var costHigh = kwp * installType.high;

    document.getElementById("out-panels").textContent = panelCount + " panels (" + panelWatts + "Wp each)";
    document.getElementById("out-area").textContent = "\u2248 " + roofArea + " m\u00b2";
    document.getElementById("out-yield").textContent = dailyYieldLow + "\u2013" + dailyYieldHigh + " kWh / day";
    document.getElementById("out-cost").textContent = formatPeso(costLow) + " \u2013 " + formatPeso(costHigh);

    document.getElementById("out-type").textContent = installType.label;
  }

  function initCalculator() {
    var range = document.getElementById("kwp-range");
    if (!range) return;
    ["kwp-range", "panel-watts", "install-type"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", runCalculator);
      document.getElementById(id).addEventListener("change", runCalculator);
    });
    runCalculator();
  }

  /* ---------------- Hero project showcase ---------------- */

  function initShowcase() {
    var frame = document.getElementById("showcase");
    if (!frame) return;

    var slides = Array.prototype.slice.call(frame.querySelectorAll(".slide"));
    var dotsWrap = document.getElementById("showcase-dots");
    var prevBtn = document.getElementById("showcase-prev");
    var nextBtn = document.getElementById("showcase-next");
    if (slides.length < 2) return;

    var index = 0;
    var timer = null;
    var INTERVAL = 3000;
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Build the dot controls from the slides themselves
    var dots = slides.map(function (slide, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-label", "Project " + (i + 1));
      b.setAttribute("aria-selected", i === 0 ? "true" : "false");
      b.addEventListener("click", function () {
        go(i);
        restart();
      });
      dotsWrap.appendChild(b);
      return b;
    });

    function go(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (s, i) {
        s.classList.toggle("active", i === index);
      });
      dots.forEach(function (d, i) {
        d.setAttribute("aria-selected", i === index ? "true" : "false");
      });
    }

    function advance() { go(index + 1); }

    function start() {
      if (reduceMotion) return; // respect the user's motion preference
      stop();
      timer = setInterval(advance, INTERVAL);
    }
    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }
    function restart() { stop(); start(); }

    prevBtn.addEventListener("click", function () { go(index - 1); restart(); });
    nextBtn.addEventListener("click", function () { advance(); restart(); });

    // Pause while the visitor is looking at or interacting with the frame
    frame.addEventListener("mouseenter", stop);
    frame.addEventListener("mouseleave", start);
    frame.addEventListener("focusin", stop);
    frame.addEventListener("focusout", start);

    // Stop animating when the tab is in the background
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) { stop(); } else { start(); }
    });

    // Arrow-key navigation
    frame.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { go(index - 1); restart(); }
      if (e.key === "ArrowRight") { advance(); restart(); }
    });

    // Swipe on touch devices
    var touchX = null;
    frame.addEventListener("touchstart", function (e) {
      touchX = e.changedTouches[0].clientX;
      stop();
    }, { passive: true });
    frame.addEventListener("touchend", function (e) {
      if (touchX === null) return;
      var dx = e.changedTouches[0].clientX - touchX;
      if (Math.abs(dx) > 45) { dx < 0 ? advance() : go(index - 1); }
      touchX = null;
      start();
    }, { passive: true });

    go(0);
    start();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initRouting();
    initShowcase();
    initNavToggle();
    initQuoteButtons();
    initContactForm();
    initSentModal();
    initCalculator();
  });
})();
