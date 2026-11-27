'use strict';

// The baby penguin drawing, shared by the desktop penguin and the kick animation.
document.getElementById('penguin-slot').outerHTML = `
  <svg id="penguin" class="hit" viewBox="0 0 160 170" aria-label="Baby penguin">
    <title>Drag to move</title>
    <ellipse class="shadow" cx="80" cy="160" rx="42" ry="6"/>
    <g class="body">
      <ellipse class="foot" cx="60" cy="153" rx="17" ry="8"/>
      <ellipse class="foot" cx="100" cy="153" rx="17" ry="8"/>
      <path class="flipper left" d="M38 86 C16 96 10 122 18 130 C27 132 40 118 46 104 Z"/>
      <path class="flipper right" d="M122 86 C144 96 150 122 142 130 C133 132 120 118 114 104 Z"/>
      <!-- fluffy grey chick body -->
      <path class="fluff" d="M80 20 C116 20 128 48 128 76 C140 108 134 154 80 154 C26 154 20 108 32 76 C32 48 44 20 80 20 Z"/>
      <ellipse class="belly" cx="80" cy="120" rx="32" ry="29"/>
      <path class="cap" d="M80 20 C112 20 125 43 125 66 C125 88 107 96 80 96 C53 96 35 88 35 66 C35 43 48 20 80 20 Z"/>
      <path class="face" d="M80 49 C88 37 115 40 115 65 C115 84 98 91 80 91 C62 91 45 84 45 65 C45 40 72 37 80 49 Z"/>
      <path class="tuft" d="M78 22 C72 10 80 6 82 14 C86 6 96 10 87 22"/>
      <g class="eyes open">
        <circle cx="64" cy="64" r="6.5"/><circle cx="96" cy="64" r="6.5"/>
        <circle class="shine" cx="66" cy="61.5" r="2.2"/><circle class="shine" cx="98" cy="61.5" r="2.2"/>
      </g>
      <g class="eyes happy"><path d="M57 66 Q64 57 71 66"/><path d="M89 66 Q96 57 103 66"/></g>
      <g class="brows"><path d="M55 50 L72 57"/><path d="M105 50 L88 57"/></g>
      <path class="beak" d="M69 72 Q80 68 91 72 Q86 83 80 84 Q74 83 69 72 Z"/>
      <ellipse class="cheek" cx="54" cy="76" rx="6" ry="3.5"/>
      <ellipse class="cheek" cx="106" cy="76" rx="6" ry="3.5"/>
      <g class="headphones">
        <path d="M36 64 C36 4 124 4 124 64"/>
        <rect x="27" y="54" width="15" height="28" rx="7"/>
        <rect x="118" y="54" width="15" height="28" rx="7"/>
      </g>
    </g>
  </svg>
`;
