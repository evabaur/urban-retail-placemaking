// Shared Framework and Glossary content.
// Part A's Frameworks/Glossary tabs render directly from these arrays, and
// Part B's info-icon lookups resolve into them by key, so both stay in sync.
//
// Showcase build: the course's framework text has been replaced with
// placeholder content. Keys and structure match the live app.

export const FRAMEWORKS = [
  {
    key: "sems",
    title: "Sample Framework 1",
    sections: [
      {
        key: "main",
        title: "Sample Framework 1",
        html: `
          <p>Placeholder content for the public showcase build. The live course app shows the instructor’s framework here.</p>
          <ul class="trait-list">
            <li><strong>Dimension one</strong> — what to look for on site.</li>
            <li><strong>Dimension two</strong> — how to record it in your notes.</li>
            <li><strong>Dimension three</strong> — how it connects to strategy.</li>
          </ul>
        `,
      },
    ],
  },
  {
    key: "semiotic-space",
    title: "Sample Framework 2",
    sections: [
      {
        key: "dimensions",
        title: "Sample Framework 2 · Part 1",
        html: `
          <p>Placeholder content for the public showcase build. The live course app shows the instructor’s framework here.</p>
          <ul class="trait-list">
            <li><strong>Dimension one</strong> — what to look for on site.</li>
            <li><strong>Dimension two</strong> — how to record it in your notes.</li>
            <li><strong>Dimension three</strong> — how it connects to strategy.</li>
          </ul>
        `,
      },
      {
        key: "space-types",
        title: "Sample Framework 2 · Part 2",
        html: `
          {{SUBHEADING}}
          <p>Placeholder content for the public showcase build. The live course app shows the instructor’s framework here.</p>
          <ul class="trait-list">
            <li><strong>Dimension one</strong> — what to look for on site.</li>
            <li><strong>Dimension two</strong> — how to record it in your notes.</li>
            <li><strong>Dimension three</strong> — how it connects to strategy.</li>
          </ul>
        `,
      },
    ],
  },
  {
    key: "retail-archetypes",
    title: "Sample Framework 3",
    sections: [
      {
        key: "market",
        title: "Sample Framework 3 · Part 1",
        html: `
          <p>Placeholder content for the public showcase build. The live course app shows the instructor’s framework here.</p>
          <ul class="trait-list">
            <li><strong>Dimension one</strong> — what to look for on site.</li>
            <li><strong>Dimension two</strong> — how to record it in your notes.</li>
            <li><strong>Dimension three</strong> — how it connects to strategy.</li>
          </ul>
        `,
      },
      {
        key: "warehouse",
        title: "Sample Framework 3 · Part 2",
        html: `
          {{SUBHEADING}}
          <p>Placeholder content for the public showcase build. The live course app shows the instructor’s framework here.</p>
          <ul class="trait-list">
            <li><strong>Dimension one</strong> — what to look for on site.</li>
            <li><strong>Dimension two</strong> — how to record it in your notes.</li>
            <li><strong>Dimension three</strong> — how it connects to strategy.</li>
          </ul>
        `,
      },
      {
        key: "museum",
        title: "Sample Framework 3 · Part 3",
        html: `
          {{SUBHEADING}}
          <p>Placeholder content for the public showcase build. The live course app shows the instructor’s framework here.</p>
          <ul class="trait-list">
            <li><strong>Dimension one</strong> — what to look for on site.</li>
            <li><strong>Dimension two</strong> — how to record it in your notes.</li>
            <li><strong>Dimension three</strong> — how it connects to strategy.</li>
          </ul>
        `,
      },
    ],
  },
  {
    key: "placemaking-elements",
    title: "Sample Framework 4",
    sections: [
      {
        key: "main",
        title: "Sample Framework 4",
        html: `
          <p>Placeholder content for the public showcase build. The live course app shows the instructor’s framework here.</p>
          <ul class="trait-list">
            <li><strong>Dimension one</strong> — what to look for on site.</li>
            <li><strong>Dimension two</strong> — how to record it in your notes.</li>
            <li><strong>Dimension three</strong> — how it connects to strategy.</li>
          </ul>
        `,
      },
    ],
  },
  {
    key: "genius-loci",
    title: "Sample Framework 5",
    sections: [
      {
        key: "definition",
        title: "Sample Framework 5 · Part 1",
        html: `
          <p>Placeholder content for the public showcase build. The live course app shows the instructor’s framework here.</p>
          <ul class="trait-list">
            <li><strong>Dimension one</strong> — what to look for on site.</li>
            <li><strong>Dimension two</strong> — how to record it in your notes.</li>
            <li><strong>Dimension three</strong> — how it connects to strategy.</li>
          </ul>
        `,
      },
      {
        key: "concept",
        title: "Sample Framework 5 · Part 2",
        html: `
          {{SUBHEADING}}
          <p>Placeholder content for the public showcase build. The live course app shows the instructor’s framework here.</p>
          <ul class="trait-list">
            <li><strong>Dimension one</strong> — what to look for on site.</li>
            <li><strong>Dimension two</strong> — how to record it in your notes.</li>
            <li><strong>Dimension three</strong> — how it connects to strategy.</li>
          </ul>
        `,
      },
    ],
  },
  {
    key: "ethnographic-observation",
    title: "Sample Framework 6",
    sections: [
      {
        key: "main",
        title: "Sample Framework 6",
        html: `
          <p>Placeholder content for the public showcase build. The live course app shows the instructor’s framework here.</p>
          <ul class="trait-list">
            <li><strong>Dimension one</strong> — what to look for on site.</li>
            <li><strong>Dimension two</strong> — how to record it in your notes.</li>
            <li><strong>Dimension three</strong> — how it connects to strategy.</li>
          </ul>
        `,
      },
    ],
  },
];

export const GLOSSARY = [
  {
    key: "binary-opposition",
    title: "Sample Term 1",
    html: `<p>Placeholder definition for the showcase build.</p>`,
  },
  {
    key: "semiotic-code",
    title: "Sample Term 2",
    html: `<p>Placeholder definition for the showcase build.</p>`,
  },
  {
    key: "sem",
    title: "Sample Term 3",
    html: `<p>Placeholder definition for the showcase build.</p>`,
  },
  {
    key: "hyperreality",
    title: "Sample Term 4",
    html: `<p>Placeholder definition for the showcase build.</p>`,
  },
  {
    key: "brand-gestalt",
    title: "Sample Term 5",
    html: `<p>Placeholder definition for the showcase build.</p>`,
  },
  {
    key: "logic-and-magic",
    title: "Sample Term 6",
    html: `<p>Placeholder definition for the showcase build.</p>`,
  },
  {
    key: "semiotic-disruption",
    title: "Sample Term 7",
    html: `<p>Placeholder definition for the showcase build.</p>`,
  },
  {
    key: "placemaking",
    title: "Sample Term 8",
    html: `<p>Placeholder definition for the showcase build.</p>`,
  },
  {
    key: "aesthetic-labor",
    title: "Sample Term 9",
    html: `<p>Placeholder definition for the showcase build.</p>`,
  },
  {
    key: "emotional-labor",
    title: "Sample Term 10",
    html: `<p>Placeholder definition for the showcase build.</p>`,
  },
  {
    key: "blanding",
    title: "Sample Term 11",
    html: `<p>Placeholder definition for the showcase build.</p>`,
  },
];

// Combined lookups used by Part B info icons.
export const LOOKUPS = [
  {
    key: "harmony-disruption",
    title: "Sample Lookup",
    html: `<p>Placeholder content for the showcase build.</p>`,
  },
];
