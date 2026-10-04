"use client";

import Image from "next/image";
import { useState, type CSSProperties, type FormEvent } from "react";
import {
  ageRangeOptions,
  bodyTypeOptions,
  eyeColorOptions,
  GENERATION_CREDIT_COST,
  genderOptions,
  hairColorOptions,
  hairStyleOptions,
  skinToneOptions,
  vibeOptions,
  type InfluencerTraits,
} from "@/lib/influencers/options";
import { buildInfluencerPrompts } from "@/lib/influencers/prompt";

type GeneratedModel = {
  id: string;
  name: string;
  portraitUrl: string;
  fullBodyUrl: string;
};

type GeneratedPreview = {
  name: string;
  traits: InfluencerTraits;
  extraDetails: string;
  portraitUrl: string;
  fullBodyUrl: string;
  saved: boolean;
  id?: string;
};

type InfluencerBuilderProps = {
  initialCredits: number | null;
  imageGenerationConfigured: boolean;
};

const initialTraits: InfluencerTraits = {
  gender: "Female",
  bodyType: "Curvy",
  skinTone: "Medium",
  ageRange: "25–34",
  hairStyle: "Long waves",
  hairColor: "Chestnut",
  eyeColor: "Brown",
  vibe: "Soft & dreamy",
};

const traitEmojis: Record<string, string> = {
  Petite: "🌷",
  Athletic: "🏃",
  Slim: "🦢",
  Curvy: "🍑",
  "Plus size": "💛",
  Muscular: "💪",
  "Long waves": "〰️",
  "Soft curls": "🌀",
  Straight: "✨",
  "Bob cut": "✂️",
  Braids: "🪢",
  Pixie: "🧚",
  Coils: "💫",
  "Slicked back": "🪞",
  "Jet black": "🖤",
  "Dark brown": "🤎",
  Chestnut: "🍂",
  "Honey blonde": "🍯",
  "Platinum blonde": "🤍",
  Auburn: "🧡",
  Silver: "🩶",
  Colorful: "🎨",
  Brown: "🤎",
  "Dark brown eyes": "🤎",
  Hazel: "🌰",
  Green: "🌿",
  Blue: "🩵",
  Gray: "🩶",
};

export function InfluencerBuilder({
  initialCredits,
  imageGenerationConfigured,
}: InfluencerBuilderProps) {
  const [name, setName] = useState("");
  const [traits, setTraits] = useState(initialTraits);
  const [extraDetails, setExtraDetails] = useState("");
  const [credits, setCredits] = useState(initialCredits);
  const [generatedModel, setGeneratedModel] = useState<GeneratedPreview | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const updateTrait = <K extends keyof InfluencerTraits>(
    key: K,
    value: InfluencerTraits[K],
  ) => {
    setTraits((current) => ({ ...current, [key]: value }));
  };

  const prompts = buildInfluencerPrompts(
    name.trim() || "your new creator",
    traits,
    extraDetails,
  );

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setGeneratedModel(null);

    if (credits !== null && credits < GENERATION_CREDIT_COST) {
      setErrorMessage(
        `You need ${GENERATION_CREDIT_COST} credits to generate a model. Your current balance is ${credits}.`,
      );
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/influencers/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, traits, extraDetails }),
      });
      const payload = (await response.json()) as {
        error?: string;
        preview?: {
          name: string;
          traits: InfluencerTraits;
          extraDetails: string;
          portraitDataUrl: string;
          fullBodyDataUrl: string;
        };
      };

      if (!response.ok || !payload.preview) {
        throw new Error(payload.error ?? "We couldn’t create your influencer. Please try again.");
      }

      setGeneratedModel({
        name: payload.preview.name,
        traits: payload.preview.traits,
        extraDetails: payload.preview.extraDetails,
        portraitUrl: payload.preview.portraitDataUrl,
        fullBodyUrl: payload.preview.fullBodyDataUrl,
        saved: false,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn’t create your influencer. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveModel() {
    if (!generatedModel || generatedModel.saved || isSaving) {
      return;
    }

    setErrorMessage("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/influencers/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: generatedModel.name,
          traits: generatedModel.traits,
          extraDetails: generatedModel.extraDetails,
          portraitDataUrl: generatedModel.portraitUrl,
          fullBodyDataUrl: generatedModel.fullBodyUrl,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        remainingCredits?: number;
        model?: GeneratedModel;
      };

      if (typeof payload.remainingCredits === "number") {
        setCredits(payload.remainingCredits);
        window.dispatchEvent(
          new CustomEvent("postly:credits-updated", {
            detail: payload.remainingCredits,
          }),
        );
      }

      if (!response.ok || !payload.model) {
        throw new Error(payload.error ?? "We couldn’t save this model. Please try again.");
      }

      setGeneratedModel((current) =>
        current
          ? {
              ...current,
              id: payload.model?.id,
              name: payload.model?.name ?? current.name,
              portraitUrl: payload.model?.portraitUrl ?? current.portraitUrl,
              fullBodyUrl: payload.model?.fullBodyUrl ?? current.fullBodyUrl,
              saved: true,
            }
          : current,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn’t save this model. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="model-builder">
      <form className="model-builder-form" onSubmit={handleGenerate}>
        <section className="builder-section builder-intro">
          <div className="builder-section-title">
            <span className="builder-number">01</span>
            <div><h2>Meet your new muse</h2><p>Start with a name and make them yours.</p></div>
          </div>
          <label className="builder-label" htmlFor="influencer-name">Influencer name</label>
          <div className="builder-input-wrap">
            <span aria-hidden="true">✎</span>
            <input
              autoComplete="off"
              id="influencer-name"
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Maya Rose"
              required
              value={name}
            />
            <span className="builder-input-limit">{name.length}/60</span>
          </div>
        </section>

        <section className="builder-section">
          <div className="builder-section-title">
            <span className="builder-number">02</span>
            <div><h2>The essentials</h2><p>A few details bring their look to life.</p></div>
          </div>

          <fieldset className="builder-fieldset">
            <legend>Gender</legend>
            <div className="builder-choice-row builder-gender-row">
              {genderOptions.map((option) => (
                <button
                  aria-pressed={traits.gender === option}
                  className={`builder-choice${traits.gender === option ? " selected" : ""}`}
                  key={option}
                  onClick={() => updateTrait("gender", option)}
                  type="button"
                >
                  <span>{option === "Female" ? "♀" : "♂"}</span>{option}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="builder-fieldset">
            <legend>Body type</legend>
            <div className="builder-option-grid">
              {bodyTypeOptions.map((option) => (
                <button
                  aria-pressed={traits.bodyType === option}
                  className={`builder-option${traits.bodyType === option ? " selected" : ""}`}
                  key={option}
                  onClick={() => updateTrait("bodyType", option)}
                  type="button"
                >
                  <span aria-hidden="true">{traitEmojis[option]}</span>{option}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="builder-fieldset">
            <legend>Skin tone</legend>
            <div className="skin-tone-list">
              {skinToneOptions.map((option) => (
                <button
                  aria-label={option.name}
                  aria-pressed={traits.skinTone === option.name}
                  className={`skin-tone-choice${traits.skinTone === option.name ? " selected" : ""}`}
                  key={option.name}
                  onClick={() => updateTrait("skinTone", option.name)}
                  style={{ "--skin-tone": option.color } as CSSProperties}
                  title={option.name}
                  type="button"
                >
                  <span className="skin-tone-color" />
                  <span className="skin-tone-name">{option.name}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="builder-fieldset">
            <legend>Age range <span className="builder-legend-note">All characters are 18+</span></legend>
            <div className="builder-age-row">
              {ageRangeOptions.map((option) => (
                <button
                  aria-pressed={traits.ageRange === option}
                  className={`builder-age-choice${traits.ageRange === option ? " selected" : ""}`}
                  key={option}
                  onClick={() => updateTrait("ageRange", option)}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="builder-section">
          <div className="builder-section-title">
            <span className="builder-number">03</span>
            <div><h2>The little details</h2><p>Now for the details that make them unmistakably them.</p></div>
          </div>

          <fieldset className="builder-fieldset">
            <legend>Hair style</legend>
            <div className="builder-option-grid">
              {hairStyleOptions.map((option) => (
                <button
                  aria-pressed={traits.hairStyle === option}
                  className={`builder-option${traits.hairStyle === option ? " selected" : ""}`}
                  key={option}
                  onClick={() => updateTrait("hairStyle", option)}
                  type="button"
                >
                  <span aria-hidden="true">{traitEmojis[option]}</span>{option}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="builder-fieldset">
            <legend>Hair color</legend>
            <div className="builder-chip-list">
              {hairColorOptions.map((option) => (
                <button
                  aria-pressed={traits.hairColor === option}
                  className={`builder-chip${traits.hairColor === option ? " selected" : ""}`}
                  key={option}
                  onClick={() => updateTrait("hairColor", option)}
                  type="button"
                >
                  <span aria-hidden="true">{traitEmojis[option]}</span>{option}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="builder-fieldset">
            <legend>Eye color</legend>
            <div className="builder-chip-list">
              {eyeColorOptions.map((option) => (
                <button
                  aria-pressed={traits.eyeColor === option}
                  className={`builder-chip${traits.eyeColor === option ? " selected" : ""}`}
                  key={option}
                  onClick={() => updateTrait("eyeColor", option)}
                  type="button"
                >
                  <span aria-hidden="true">{traitEmojis[option] ?? "👁️"}</span>{option}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="builder-fieldset">
            <legend>Vibe / aesthetic</legend>
            <div className="vibe-grid">
              {vibeOptions.map((option) => (
                <button
                  aria-pressed={traits.vibe === option.name}
                  className={`vibe-choice${traits.vibe === option.name ? " selected" : ""}`}
                  key={option.name}
                  onClick={() => updateTrait("vibe", option.name)}
                  type="button"
                >
                  <span aria-hidden="true">{option.emoji}</span>{option.name}
                </button>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="builder-section builder-prompt-section">
          <div className="builder-section-title">
            <span className="builder-number">04</span>
            <div><h2>The prompt, made personal</h2><p>We’ve brought your choices together. Add any final touches.</p></div>
          </div>
          <div className="builder-prompt-preview">
            <div className="builder-prompt-heading"><span>✧</span> YOUR CREATOR BLUEPRINT <span className="builder-prompt-live">LIVE</span></div>
            <p>{prompts.combined}</p>
          </div>
          <label className="builder-label" htmlFor="extra-details">A few extra details <span>OPTIONAL</span></label>
          <textarea
            id="extra-details"
            maxLength={500}
            onChange={(event) => setExtraDetails(event.target.value)}
            placeholder="Maybe a signature accessory, a favorite setting, or a little detail that makes them special..."
            rows={3}
            value={extraDetails}
          />
          <span className="builder-textarea-limit">{extraDetails.length}/500</span>
        </section>

        {errorMessage && (
          <div className="builder-error" role="alert">{errorMessage}</div>
        )}
        {!imageGenerationConfigured && (
          <div className="builder-setup-hint" role="status">
            Add <code>POLLINATIONS_API_KEY</code> to your server environment to enable real image generation. Credits won’t be used until generation starts.
          </div>
        )}
        <button
          className="button button-dark builder-generate"
          disabled={isGenerating || !imageGenerationConfigured}
          type="submit"
        >
          {isGenerating ? <><span className="builder-spinner" /> Creating your influencer...</> : <><span aria-hidden="true">✧</span> Generate influencer <span className="builder-cost">−{GENERATION_CREDIT_COST} credits</span></>}
        </button>
        <p className="builder-refund-note">Preview first. 50 credits are charged only when you save your model.</p>
      </form>

      <aside aria-live="polite" className="model-preview">
        <div className="model-preview-heading">
          <div><span className="section-kicker">THE FIRST LOOK</span><h2>Your model preview</h2></div>
          <span className="preview-live-dot" />
        </div>

        <div className="preview-image-pair">
          <div className="preview-image-frame preview-portrait-frame">
            {generatedModel ? (
              <Image
                alt={`Portrait of ${generatedModel.name}`}
                className="generated-model-image"
                height={960}
                src={generatedModel.portraitUrl}
                unoptimized
                width={720}
              />
            ) : (
              <div className="preview-image-placeholder portrait-placeholder">
                <span className="placeholder-halo" />
                <span className="placeholder-face">☺</span>
                <span className="placeholder-flower">✿</span>
                <small>PORTRAIT</small>
              </div>
            )}
            <span className="preview-image-label">✧ PORTRAIT</span>
          </div>
          <div className="preview-image-frame preview-full-frame">
            {generatedModel ? (
              <Image
                alt={`Full-body image of ${generatedModel.name}`}
                className="generated-model-image"
                height={960}
                src={generatedModel.fullBodyUrl}
                unoptimized
                width={640}
              />
            ) : (
              <div className="preview-image-placeholder fullbody-placeholder">
                <span className="placeholder-halo" />
                <span className="placeholder-person">♙</span>
                <span className="placeholder-flower">✦</span>
                <small>FULL BODY</small>
              </div>
            )}
            <span className="preview-image-label">✦ FULL BODY</span>
          </div>
        </div>

        {generatedModel && !generatedModel.saved && (
          <button
            className="button button-dark preview-save-button"
            disabled={isSaving || isGenerating}
            onClick={handleSaveModel}
            type="button"
          >
            {isSaving
              ? <><span className="builder-spinner" /> Saving model...</>
              : <><span aria-hidden="true">✓</span> Save this model <span className="builder-cost">−{GENERATION_CREDIT_COST} credits</span></>}
          </button>
        )}

        <div className="preview-model-name">
          <span className="preview-avatar">{generatedModel?.name.slice(0, 1).toUpperCase() || name.trim().slice(0, 1).toUpperCase() || "✧"}</span>
          <span><small>YOUR AI CREATOR</small><strong>{generatedModel?.name || name.trim() || "Your new influencer"}</strong></span>
          <span className="preview-model-badge">AI MODEL</span>
        </div>

        <div className="preview-trait-list">
          <div><span>Style</span><strong>{generatedModel?.traits.vibe ?? traits.vibe}</strong></div>
          <div><span>Age range</span><strong>{generatedModel?.traits.ageRange ?? traits.ageRange}</strong></div>
          <div><span>Hair</span><strong>{generatedModel?.traits.hairStyle ?? traits.hairStyle}, {(generatedModel?.traits.hairColor ?? traits.hairColor).toLowerCase()}</strong></div>
          <div><span>Eyes</span><strong>{generatedModel?.traits.eyeColor ?? traits.eyeColor}</strong></div>
        </div>

        {isGenerating && (
          <div className="preview-generating"><span className="builder-spinner" /> Dreaming up your creator...</div>
        )}
        {generatedModel && (
          <div className="preview-complete">
            <span>{generatedModel.saved ? "✓" : "✧"}</span>
            {generatedModel.saved
              ? "Your creator is saved to your studio."
              : "Preview ready. Save it to add it to your studio."}
          </div>
        )}
        <div className="preview-credit-note"><span>✧</span> {GENERATION_CREDIT_COST} credits per model · {credits ?? "—"} left</div>
      </aside>
    </div>
  );
}
