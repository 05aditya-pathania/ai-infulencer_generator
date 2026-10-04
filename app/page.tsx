import Link from "next/link";

type IconName =
  | "arrow"
  | "sparkles"
  | "calendar"
  | "pen"
  | "chart"
  | "check"
  | "play"
  | "plus"
  | "clock"
  | "menu";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <path d="M5 12h14m-7-7 7 7-7 7" />,
    sparkles: (
      <>
        <path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" />
        <path d="m19 14 1.1 2.9L23 18l-2.9 1.1L19 22l-1.1-2.9L15 18l2.9-1.1L19 14Z" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 11h18" />
      </>
    ),
    pen: (
      <>
        <path d="m15 5 4 4M4 20l4.5-1 10.7-10.7a2.1 2.1 0 0 0-3-3L5.5 16 4 20Z" />
        <path d="M13 20h8" />
      </>
    ),
    chart: (
      <>
        <path d="M3 3v18h18" />
        <path d="m19 9-5 5-4-4-5 5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    play: <path d="m9 6 10 6-10 6V6Z" />,
    plus: <path d="M12 5v14m-7-7h14" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

const features = [
  {
    icon: "sparkles" as const,
    number: "01",
    title: "Ideas, meet done.",
    description:
      "Turn a half-formed thought into platform-ready captions, hooks, and post ideas in seconds.",
    tone: "lavender",
  },
  {
    icon: "calendar" as const,
    number: "02",
    title: "Your whole week, sorted.",
    description:
      "See every channel in one calm calendar. Pick a time, queue it up, and get back to your day.",
    tone: "lime",
  },
  {
    icon: "chart" as const,
    number: "03",
    title: "Know what’s working.",
    description:
      "Simple, human analytics show what your audience loves and what to make more of next.",
    tone: "peach",
  },
];

const plans = [
  {
    name: "Free",
    description: "A little momentum goes a long way.",
    price: "$0",
    period: "forever",
    features: ["1 social account", "10 AI generations / month", "Basic post scheduler"],
    action: "Start for free",
    featured: false,
  },
  {
    name: "Creator",
    description: "For your next big thing.",
    price: "$19",
    period: "per month",
    features: [
      "5 social accounts",
      "Unlimited AI generations",
      "Smart scheduling",
      "Performance insights",
    ],
    action: "Try Creator free",
    featured: true,
  },
  {
    name: "Studio",
    description: "Big ideas are better together.",
    price: "$49",
    period: "per month",
    features: [
      "Unlimited social accounts",
      "Everything in Creator",
      "3 team seats",
      "Priority support",
    ],
    action: "Meet your new studio",
    featured: false,
  },
];

const faqs = [
  {
    question: "Which social platforms can I connect?",
    answer:
      "You can plan content for Instagram, TikTok, LinkedIn, Facebook, Pinterest, and X from one place. Available publishing options depend on each platform.",
  },
  {
    question: "Do I need to know how to write prompts?",
    answer:
      "Not at all. Tell Postly what you’re sharing and who it’s for. Our guided creator makes it easy to get a useful first draft without prompt engineering.",
  },
  {
    question: "Can I review posts before they go out?",
    answer:
      "Always. Every AI draft is yours to edit, approve, schedule, or delete. Nothing is published without you choosing what happens next.",
  },
  {
    question: "Can I change or cancel my plan?",
    answer:
      "Yes. You can switch plans or cancel any time from your account. Your free plan will still be here if you want to come back.",
  },
];

function BrandMark() {
  return (
    <a className="brand" href="#top" aria-label="Postly home">
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      <span>postly</span>
    </a>
  );
}

function ProductPreview() {
  return (
    <div className="product-preview" aria-label="Preview of the Postly content planner">
      <div className="preview-window">
        <aside className="preview-sidebar">
          <BrandMark />
          <div className="sidebar-label">WORKSPACE</div>
          <div className="sidebar-link active"><span className="sidebar-icon"><Icon name="calendar" size={16} /></span>Planner</div>
          <div className="sidebar-link"><span className="sidebar-icon"><Icon name="sparkles" size={16} /></span>AI studio</div>
          <div className="sidebar-link"><span className="sidebar-icon"><Icon name="chart" size={16} /></span>Analytics</div>
          <div className="sidebar-account">
            <div className="account-avatar">J</div>
            <div><strong>Jamie Parker</strong><small>Creator plan</small></div>
            <span className="account-dots">···</span>
          </div>
        </aside>
        <div className="preview-main">
          <div className="preview-topline">
            <div>
              <span className="eyebrow">MONDAY, JUNE 16</span>
              <h3>Your content planner</h3>
            </div>
            <button className="new-post-button" type="button"><Icon name="plus" size={15} /> New post</button>
          </div>
          <div className="preview-tabs"><span className="selected">Week</span><span>Month</span><span>Queue</span><span className="tabs-spacer" /><span className="week-label">Jun 16 – 22 <span>⌄</span></span></div>
          <div className="planner-grid">
            {["MON 16", "TUE 17", "WED 18", "THU 19", "FRI 20"].map((day, index) => (
              <div className="planner-day" key={day}>
                <span className={index === 0 ? "day-label today" : "day-label"}>{day}</span>
                {index === 0 && <div className="post-card post-lilac"><span className="network instagram">◎</span><span>Behind the scenes ✨</span><small>9:30 AM</small></div>}
                {index === 1 && <div className="post-card post-peach"><span className="network linkedin">in</span><span>3 things I wish I knew...</span><small>11:00 AM</small></div>}
                {index === 2 && <div className="post-card post-lime"><span className="network tiktok">♪</span><span>Your 15-sec reset 🌱</span><small>12:15 PM</small></div>}
                {index === 3 && <div className="post-card post-lilac"><span className="network instagram">◎</span><span>A small reminder 💜</span><small>10:00 AM</small></div>}
                {index === 4 && <div className="post-card post-peach"><span className="network instagram">◎</span><span>Weekend moodboard</span><small>8:45 AM</small></div>}
              </div>
            ))}
          </div>
          <div className="ai-nudge"><span className="nudge-icon"><Icon name="sparkles" size={16} /></span><span><strong>A little inspiration?</strong><small>You have 2 open spots this week</small></span><button type="button" aria-label="Get an idea"><Icon name="arrow" size={17} /></button></div>
        </div>
      </div>
      <div className="float-note note-top"><span className="float-check"><Icon name="check" size={15} /></span><span><strong>Post scheduled!</strong><small>Your audience is going to love it</small></span></div>
      <div className="float-note note-bottom"><span className="float-spark"><Icon name="sparkles" size={17} /></span><span><strong>Your next idea, ready</strong><small>Made just for your voice</small></span><span className="note-arrow">↗</span></div>
    </div>
  );
}

export default function Home() {
  return (
    <main id="top">
      <header className="site-header">
        <div className="header-inner">
          <BrandMark />
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQs</a>
          </nav>
          <div className="header-actions">
            <Link className="login-link" href="/auth?mode=signin">Log in</Link>
            <Link className="button button-dark header-cta" href="/auth?mode=signup">Get started <Icon name="arrow" size={16} /></Link>
          </div>
          <a className="mobile-menu" href="#features" aria-label="Jump to features"><Icon name="menu" /></a>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="announcement"><span className="announcement-dot" /> YOUR CONTENT ERA STARTS HERE <span className="announcement-arrow">↗</span></div>
            <h1>Make good<br />content. <span>More often.</span></h1>
            <p className="hero-description">Your ideas deserve an audience. Create scroll-stopping posts with AI and get them on the calendar — all in one happy little place.</p>
            <div className="hero-actions">
              <Link className="button button-dark button-large" href="/auth?mode=signup">Start creating for free <Icon name="arrow" size={18} /></Link>
              <a className="demo-link" href="#how-it-works"><span><Icon name="play" size={14} /></span> See how it works</a>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack"><span>J</span><span>M</span><span>A</span><span>K</span></div>
              <div><div className="star-row">★★★★★ <span>4.9/5</span></div><p>Loved by 12,000+ creators</p></div>
            </div>
          </div>
          <ProductPreview />
        </div>
        <div className="hero-scribble" aria-hidden="true">✳</div>
      </section>

      <section className="social-proof" aria-label="Supported social platforms">
        <p>ALL YOUR CHANNELS. ONE VERY GOOD PLAN.</p>
        <div className="social-list">
          <span><i className="social-instagram">◎</i> Instagram</span>
          <span><i className="social-tiktok">♪</i> TikTok</span>
          <span><i className="social-linkedin">in</i> LinkedIn</span>
          <span><i className="social-facebook">f</i> Facebook</span>
          <span><i className="social-pinterest">p</i> Pinterest</span>
        </div>
      </section>

      <section className="features-section section-pad" id="features">
        <div className="section-heading">
          <span className="section-kicker">LESS BUSYWORK, MORE YOU</span>
          <h2>Everything social.<br /><span>Nothing overwhelming.</span></h2>
          <p>From blank page to “posted!” without the 17 open tabs and the last-minute scramble.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.number}>
              <div className={`feature-icon ${feature.tone}`}><Icon name={feature.icon} size={21} /></div>
              <span className="feature-number">{feature.number}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
              <a href="#how-it-works" className="feature-link">Take a closer look <Icon name="arrow" size={16} /></a>
            </article>
          ))}
        </div>
      </section>

      <section className="workflow-section section-pad" id="how-it-works">
        <div className="workflow-copy">
          <span className="section-kicker">A BETTER KIND OF CONTENT DAY</span>
          <h2>From “what do I post?” to <span>“already done.”</span></h2>
          <p className="workflow-intro">Meet your new favorite creative ritual. A few thoughtful clicks, and your content is ready to meet the world.</p>
          <div className="workflow-step"><span className="step-count">01</span><div><h3>Bring the seed of an idea</h3><p>A topic, a launch, a half-written note. Start wherever you are.</p></div></div>
          <div className="workflow-step"><span className="step-count">02</span><div><h3>Make it sound like you</h3><p>Get fresh ideas and captions that you can edit, tweak, and make yours.</p></div></div>
          <div className="workflow-step"><span className="step-count">03</span><div><h3>Pick a time. You’re free.</h3><p>Schedule across your channels and get back to the good stuff.</p></div></div>
          <a className="text-link" href="#pricing">Give it a go <Icon name="arrow" size={17} /></a>
        </div>
        <div className="workflow-art">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="idea-card">
            <div className="idea-card-top"><span className="idea-spark"><Icon name="sparkles" size={17} /></span><span>POSTLY AI STUDIO</span><span className="idea-dots">···</span></div>
            <div className="idea-prompt">Your idea</div>
            <div className="prompt-field">A little reminder to slow down and enjoy the process...</div>
            <div className="idea-result">
              <span className="generated-label">A CAPTION FOR YOUR INSTAGRAM</span>
              <p>You don’t have to have it all figured out to take the next step. Little by little still gets you somewhere good. 🌿</p>
              <div className="result-footer"><span>Sounds like you <i /></span><span>↗</span></div>
            </div>
            <button className="idea-button" type="button"><Icon name="sparkles" size={15} /> Make it yours</button>
          </div>
          <div className="art-sticker sticker-left">✳</div>
          <div className="art-sticker sticker-right">✦</div>
          <div className="art-caption">A little help from your AI sidekick <span>↖</span></div>
        </div>
      </section>

      <section className="quote-section">
        <div className="quote-stars">★★★★★</div>
        <blockquote>“Postly gave me back the part of creating I actually love. The ideas are flowing, and my Sunday nights are mine again.”</blockquote>
        <div className="quote-author"><span className="quote-avatar">M</span><span><strong>Morgan Ellis</strong><small>Creative coach &amp; very happy human</small></span></div>
        <span className="quote-mark" aria-hidden="true">“</span>
      </section>

      <section className="pricing-section section-pad" id="pricing">
        <div className="section-heading">
          <span className="section-kicker">GOOD THINGS, FAIR PRICES</span>
          <h2>Big creator energy.<br /><span>Small “what does this cost?” energy.</span></h2>
          <p>Start free, find your rhythm, and only grow when you’re ready.</p>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article className={`price-card${plan.featured ? " featured" : ""}`} key={plan.name}>
              {plan.featured && <div className="popular-tag">THE CROWD FAVORITE <span>✳</span></div>}
              <div className="plan-name">{plan.name}</div>
              <p className="plan-description">{plan.description}</p>
              <div className="plan-price">{plan.price}<span>{plan.period}</span></div>
              <Link className={plan.featured ? "button button-dark plan-button" : "button button-outline plan-button"} href="/auth?mode=signup">{plan.action} <Icon name="arrow" size={16} /></Link>
              <div className="plan-divider" />
              <p className="includes-label">WHAT’S INCLUDED</p>
              <ul>{plan.features.map((item) => <li key={item}><span><Icon name="check" size={14} /></span>{item}</li>)}</ul>
            </article>
          ))}
        </div>
        <p className="pricing-footnote"><Icon name="check" size={15} /> No credit card needed to start <span>·</span> Cancel any time <span>·</span> Good vibes included</p>
      </section>

      <section className="faq-section section-pad" id="faq">
        <div className="faq-heading">
          <span className="section-kicker">FAIR QUESTIONS</span>
          <h2>Wondering<br />about something?</h2>
          <p>We’re real people who like helping. <a href="mailto:hello@postly.social">Say hello ↗</a></p>
        </div>
        <div className="faq-list">
          {faqs.map((faq) => (
            <details className="faq-item" key={faq.question}>
              <summary>{faq.question}<span><Icon name="plus" size={18} /></span></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="final-cta">
        <div className="cta-decoration cta-decoration-left">✳</div>
        <div className="cta-decoration cta-decoration-right">✦</div>
        <span className="section-kicker">YOUR NEXT POST IS WAITING</span>
        <h2>Let’s make your<br />ideas <span>impossible to scroll past.</span></h2>
        <p>Less “I’ll post tomorrow.” More “that was actually fun.”</p>
        <Link className="button button-dark button-large" href="/auth?mode=signup">Start for free <Icon name="arrow" size={18} /></Link>
        <small>Free forever plan. No card. No funny business.</small>
      </section>

      <footer className="site-footer" id="footer">
        <div className="footer-top">
          <div className="footer-brand"><BrandMark /><p>Good content, more often.<br />Made for the humans behind the handles.</p></div>
          <div className="footer-links">
            <div><span>EXPLORE</span><a href="#features">Features</a><a href="#how-it-works">How it works</a><a href="#pricing">Pricing</a></div>
            <div><span>THE DETAILS</span><a href="#faq">FAQs</a><a href="mailto:hello@postly.social">Get in touch</a><a href="#footer">Privacy &amp; terms</a></div>
            <div><span>FOLLOW ALONG</span><a href="#footer">Instagram ↗</a><a href="#footer">TikTok ↗</a><a href="#footer">LinkedIn ↗</a></div>
          </div>
        </div>
        <div className="footer-bottom"><span>© 2026 Postly Studio. Made for the makers.</span><span>Made with a little <i>♥</i> and a lot of coffee.</span></div>
      </footer>
    </main>
  );
}
