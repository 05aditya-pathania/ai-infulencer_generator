import Link from "next/link";
import { notFound } from "next/navigation";

const sectionContent = {
  studio: {
    eyebrow: "YOUR AI CREATIVE SIDEKICK",
    title: "AI Studio",
    description:
      "Turn a spark of an idea into platform-ready captions, hooks, and posts that sound like you.",
    icon: "✳",
    nextTitle: "Your next great post starts with a thought.",
    nextDescription:
      "Start with a topic, a product, or just a feeling. Your creative workspace is ready when you are.",
    action: "Back to your overview",
    href: "/dashboard",
  },
  calendar: {
    eyebrow: "YOUR CONTENT PLAN",
    title: "Content calendar",
    description:
      "See your social plans at a glance and make a posting rhythm that feels good.",
    icon: "▦",
    nextTitle: "Make room for your next idea.",
    nextDescription:
      "Once you draft a post, you’ll be able to plan it here and see your week take shape.",
    action: "Create your first post",
    href: "/dashboard/studio",
  },
  accounts: {
    eyebrow: "YOUR SOCIAL CHANNELS",
    title: "Social accounts",
    description:
      "Keep your connected channels together and make publishing feel a little less scattered.",
    icon: "◎",
    nextTitle: "Your social circle starts here.",
    nextDescription:
      "Connect a social account to start planning content for your channels in one place.",
    action: "Explore your AI Studio",
    href: "/dashboard/studio",
  },
  analytics: {
    eyebrow: "THE STORY BEHIND YOUR POSTS",
    title: "Analytics",
    description:
      "Get a clearer picture of what resonates with your audience and what to try next.",
    icon: "↗",
    nextTitle: "Your insights will grow here.",
    nextDescription:
      "Connect a social account and share a few posts to start building a picture of what works.",
    action: "Connect a social account",
    href: "/dashboard/accounts",
  },
  media: {
    eyebrow: "YOUR CREATIVE TOOLKIT",
    title: "Media library",
    description:
      "A home for the visuals and creative bits you’ll use to bring your posts to life.",
    icon: "▧",
    nextTitle: "A fresh canvas, ready for you.",
    nextDescription:
      "Your images and creative assets will be easy to find here when you start creating.",
    action: "Go to AI Studio",
    href: "/dashboard/studio",
  },
  settings: {
    eyebrow: "MAKE POSTLY YOURS",
    title: "Settings",
    description:
      "Manage your profile and make your workspace feel like your own.",
    icon: "⚙",
    nextTitle: "Your workspace, your way.",
    nextDescription:
      "Your account details and preferences will live here as your workspace grows.",
    action: "Back to your overview",
    href: "/dashboard",
  },
} as const;

type DashboardSection = keyof typeof sectionContent;

function isDashboardSection(section: string): section is DashboardSection {
  return Object.hasOwn(sectionContent, section);
}

type DashboardSectionPageProps = {
  params: Promise<{ section: string }>;
};

export default async function DashboardSectionPage({
  params,
}: DashboardSectionPageProps) {
  const { section } = await params;

  if (!isDashboardSection(section)) {
    notFound();
  }

  const content = sectionContent[section];

  return (
    <div className="dashboard-page-content">
      <section className="dashboard-welcome-copy">
        <span className="section-kicker">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
      </section>
      <section className="dashboard-coming-card">
        <div className="dashboard-coming-icon">{content.icon}</div>
        <span className="dashboard-panel-eyebrow">A LITTLE SPACE TO GROW</span>
        <h2>{content.nextTitle}</h2>
        <p>{content.nextDescription}</p>
        <Link className="button button-dark dashboard-small-button" href={content.href}>
          {content.action} <span>↗</span>
        </Link>
      </section>
    </div>
  );
}
