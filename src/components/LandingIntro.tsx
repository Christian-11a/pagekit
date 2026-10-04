import {
  ArrowDown,
  ArrowUpRight,
  Check,
  Files,
  ShieldCheck,
} from "lucide-react";

export function LandingIntro({
  onChoose,
  onSamples,
  busy,
  hasPages,
}: {
  onChoose: () => void;
  onSamples: () => void;
  busy: boolean;
  hasPages: boolean;
}) {
  return (
    <section
      className={`intro ${hasPages ? "intro-is-active" : ""}`}
      aria-labelledby="intro-title"
    >
      <div className="intro-copy">
        <h1 id="intro-title">
          {hasPages ? (
            "Your pages, your order."
          ) : (
            <>
              Your PDF pages,
              <br />
              <span>in order.</span>
            </>
          )}
        </h1>
        <p>
          Combine PDFs, reorder pages, and download the result. Your files stay
          on your device.
        </p>
        <div className="intro-actions">
          {hasPages ? (
            <a className="intro-secondary" href="#workspace">
              Back to your pages <ArrowDown size={18} />
            </a>
          ) : (
            <>
              <button
                className="primary hero-button"
                onClick={onChoose}
                disabled={busy}
              >
                Choose PDFs <ArrowUpRight size={18} />
              </button>
              <button
                className="intro-secondary hero-sample"
                data-testid="hero-samples"
                onClick={onSamples}
                disabled={busy}
              >
                Try sample PDFs <ArrowDown size={15} />
              </button>
            </>
          )}
        </div>
        <div className="intro-proof">
          <ShieldCheck size={16} />
          <span>No uploads. No account. Free to use.</span>
        </div>
      </div>
      {!hasPages && (
        <div className="intro-art" aria-hidden="true">
          <div className="art-grid" />
          <div className="art-label">
            <span /> LESS SHUFFLE. MORE FLOW.
          </div>
          <div className="paper-stack paper-back">
            <div className="paper-top">
              <Files size={15} />
              <span>THE SUPPORTING PAGES</span>
            </div>
            <div className="paper-lines">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="paper-stack paper-front">
            <div className="paper-top">
              <span>YOUR NEXT CHAPTER</span>
              <span>01</span>
            </div>
            <div className="paper-heading">
              Everything,
              <br />
              in its place.
            </div>
            <div className="paper-rule" />
            <div className="paper-lines">
              <i />
              <i />
              <i />
            </div>
            <div className="paper-stamp">
              <Check size={19} />
              <span>READY TO SHARE</span>
            </div>
          </div>
          <div className="art-caption">
            <span className="caption-icon">
              <Check size={14} />
            </span>
            <span>
              A fresh start.
              <br />
              <strong>One finished PDF.</strong>
            </span>
          </div>
          <span className="art-corner">PAGEKIT / PDF ORGANIZER</span>
        </div>
      )}
    </section>
  );
}
