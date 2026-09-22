export function MissionMasthead() {
  return (
    <header className="mc-masthead" aria-labelledby="executive-overview-title">
      <div className="mc-masthead-brand">
        <img src="/brand/nasa-insignia.png" alt="NASA" className="mc-masthead-insignia" />
        <div className="min-w-0">
          <p className="mc-masthead-kicker">NASA · T–MINUS</p>
          <h1 id="executive-overview-title" className="mc-masthead-title">
            Procurement Mission Control
          </h1>
        </div>
      </div>
      <div className="mc-masthead-office">
        <p>Ames Research Center</p>
        <p>Office of Procurement</p>
      </div>
      <p className="mc-masthead-purpose">T-Minus turns acquisition time into mission readiness.</p>
    </header>
  );
}
