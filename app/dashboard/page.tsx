import Link from "next/link";

export default async function DashboardPage() {
  return (
    <div className="dashboard-page-content">
      <section className="dashboard-welcome-copy">
        <span className="section-kicker">YOUR CREATOR WORKSPACE</span>
        <h1>Your ideas, in motion.</h1>
        <p>One calm place to create, plan, and show up consistently.</p>
      </section>

      <section aria-label="Workspace overview" className="dashboard-stats">
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon stat-purple">▣</span>
          <span className="dashboard-stat-copy"><span>Scheduled posts</span><strong>0 <small>queued up</small></strong></span>
          <span className="dashboard-stat-trend">↗</span>
        </article>
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon stat-green">◎</span>
          <span className="dashboard-stat-copy"><span>Social accounts</span><strong>0 <small>connected</small></strong></span>
          <span className="dashboard-stat-trend">↗</span>
        </article>
        <article className="dashboard-stat-card">
          <span className="dashboard-stat-icon stat-orange">✧</span>
          <span className="dashboard-stat-copy"><span>Ideas in your studio</span><strong>0 <small>ready to grow</small></strong></span>
          <span className="dashboard-stat-trend">↗</span>
        </article>
      </section>

      <div className="dashboard-content-grid">
        <section className="dashboard-panel dashboard-week-panel">
          <div className="dashboard-panel-heading">
            <div><span className="dashboard-panel-eyebrow">YOUR CONTENT PLAN</span><h2>This week</h2></div>
            <Link className="dashboard-panel-link" href="/dashboard/calendar">Open calendar <span>↗</span></Link>
          </div>
          <div className="dashboard-empty-week">
            <div className="empty-week-art"><span className="empty-week-sun">✳</span><span className="empty-week-page"><i /><i /><i /><b>＋</b></span></div>
            <h3>Your week is wide open.</h3>
            <p>Give your next good idea a spot on the calendar.</p>
            <Link className="button button-dark dashboard-small-button" href="/dashboard/studio">Create your first post <span>↗</span></Link>
          </div>
        </section>

        <section className="dashboard-panel dashboard-start-panel">
          <div className="dashboard-panel-heading">
            <div><span className="dashboard-panel-eyebrow">A GOOD PLACE TO START</span><h2>Your next steps</h2></div>
            <span className="dashboard-progress">0 of 3</span>
          </div>
          <div className="dashboard-steps">
            <Link href="/dashboard/accounts" className="dashboard-step">
              <span className="dashboard-step-icon step-lime">01</span>
              <span className="dashboard-step-copy"><strong>Connect a social account</strong><small>Bring your channels into one place</small></span>
              <span className="dashboard-step-arrow">↗</span>
            </Link>
            <Link href="/dashboard/studio" className="dashboard-step">
              <span className="dashboard-step-icon step-lavender">02</span>
              <span className="dashboard-step-copy"><strong>Make your first post</strong><small>Let AI help you find the words</small></span>
              <span className="dashboard-step-arrow">↗</span>
            </Link>
            <Link href="/dashboard/calendar" className="dashboard-step">
              <span className="dashboard-step-icon step-peach">03</span>
              <span className="dashboard-step-copy"><strong>Pick a time to share</strong><small>Build a posting rhythm that sticks</small></span>
              <span className="dashboard-step-arrow">↗</span>
            </Link>
          </div>
        </section>

        <section className="dashboard-idea-banner">
          <div className="dashboard-idea-orbit orbit-small-one" />
          <div className="dashboard-idea-orbit orbit-small-two" />
          <div className="dashboard-idea-copy">
            <span className="dashboard-panel-eyebrow">YOUR AI CREATIVE SIDEKICK</span>
            <h2>A blank page is just<br />an idea in disguise.</h2>
            <p>Find your next caption, hook, or whole new direction in the AI Studio.</p>
            <Link className="dashboard-idea-link" href="/dashboard/studio">Open AI Studio <span>↗</span></Link>
          </div>
          <div className="dashboard-idea-decoration"><span>✳</span><span>✦</span><div>GOOD<br />IDEAS<br /><i>LIVE HERE</i></div></div>
        </section>
      </div>
    </div>
  );
}
