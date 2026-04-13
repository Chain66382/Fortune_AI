const analysisDomains = [
  { mark: '运', label: '整体运势' },
  { mark: '情', label: '感情缘分' },
  { mark: '业', label: '事业发展' },
  { mark: '财', label: '财运财富' },
  { mark: '梦', label: '梦境解析' },
  { mark: '面', label: '面相解析' },
  { mark: '手', label: '手相解读' },
  { mark: '风', label: '空间风水' }
];

const baguaLayout = [
  {
    label: '乾',
    labelX: 210,
    labelY: 38,
    trigramX: 210,
    trigramY: 84,
    labelRotation: 0,
    trigramRotation: 0,
    pattern: [1, 1, 1]
  },
  {
    label: '艮',
    labelX: 334,
    labelY: 88,
    trigramX: 312,
    trigramY: 116,
    labelRotation: 48,
    trigramRotation: 45,
    pattern: [0, 0, 1]
  },
  {
    label: '坎',
    labelX: 382,
    labelY: 212,
    trigramX: 338,
    trigramY: 210,
    labelRotation: 90,
    trigramRotation: 90,
    pattern: [0, 1, 0]
  },
  {
    label: '巽',
    labelX: 336,
    labelY: 338,
    trigramX: 312,
    trigramY: 304,
    labelRotation: 132,
    trigramRotation: 135,
    pattern: [0, 1, 1]
  },
  {
    label: '坤',
    labelX: 210,
    labelY: 392,
    trigramX: 210,
    trigramY: 338,
    labelRotation: 180,
    trigramRotation: 180,
    pattern: [0, 0, 0]
  },
  {
    label: '震',
    labelX: 86,
    labelY: 336,
    trigramX: 110,
    trigramY: 304,
    labelRotation: -132,
    trigramRotation: 225,
    pattern: [1, 0, 0]
  },
  {
    label: '兑',
    labelX: 40,
    labelY: 210,
    trigramX: 82,
    trigramY: 210,
    labelRotation: -90,
    trigramRotation: 270,
    pattern: [1, 1, 0]
  },
  {
    label: '离',
    labelX: 88,
    labelY: 88,
    trigramX: 110,
    trigramY: 116,
    labelRotation: -48,
    trigramRotation: 315,
    pattern: [1, 0, 1]
  }
];

const renderTrigram = (pattern: number[], key: string) => (
  <g key={key}>
    {pattern.map((segment, index) => {
      const y = index * 22 - 22;

      if (segment === 1) {
        return <rect key={`${key}-${index}`} x="-22" y={y} width="44" height="10" rx="2" className="bagua-trigram-line" />;
      }

      return (
        <g key={`${key}-${index}`}>
          <rect x="-22" y={y} width="17" height="10" rx="2" className="bagua-trigram-line" />
          <rect x="5" y={y} width="17" height="10" rx="2" className="bagua-trigram-line" />
        </g>
      );
    })}
  </g>
);

export const HeroSection = () => (
  <section className="hero-shell">
    <div className="hero-copy">
      <div className="mystic-board">
        <span className="mystic-corner mystic-corner-top-left" aria-hidden="true" />
        <span className="mystic-corner mystic-corner-top-right" aria-hidden="true" />
        <span className="mystic-corner mystic-corner-bottom-left" aria-hidden="true" />
        <span className="mystic-corner mystic-corner-bottom-right" aria-hidden="true" />
        <span className="mystic-label">东方命理图谱</span>

        <div className="mystic-board-main">
          <div className="mystic-diagram-block">
            <div className="mystic-diagram-title">
              <span>天人合一　陰陽平衡</span>
            </div>

            <div className="mystic-diagram" aria-hidden="true">
              <svg viewBox="0 0 420 420" className="oracle-bagua">
                <rect x="10" y="10" width="400" height="400" rx="12" className="bagua-panel" />

                {baguaLayout.map((item) => (
                  <g key={item.label}>
                    <text
                      x={item.labelX}
                      y={item.labelY}
                      className="bagua-label"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${item.labelRotation} ${item.labelX} ${item.labelY})`}
                    >
                      {item.label}
                    </text>
                    <g transform={`translate(${item.trigramX} ${item.trigramY}) rotate(${item.trigramRotation})`}>
                      {renderTrigram(item.pattern, item.label)}
                    </g>
                  </g>
                ))}

                <circle cx="210" cy="210" r="82" className="taiji-base" />
                <path
                  d="
                    M210 128
                    A82 82 0 0 1 210 292
                    A41 41 0 0 0 210 210
                    A41 41 0 0 1 210 128
                    Z
                  "
                  className="bagua-yin"
                />
                <circle cx="210" cy="169" r="13" className="bagua-dot-light" />
                <circle cx="210" cy="251" r="13" className="bagua-dot-dark" />
              </svg>
            </div>
          </div>
        </div>

        <p className="mystic-summary">
          基于已整理的易经、六十四卦、梅花易数、风水、梦境、面相手相与星座资料，
          围绕个人背景与当下问题给出更贴近东方命理语境的判断。
        </p>

        <div className="mystic-domain-title">精准分析领域</div>
        <div className="mystic-domain-grid">
          {analysisDomains.map((domain) => (
            <div key={domain.label} className="mystic-domain-item">
              <span className="mystic-domain-mark" aria-hidden="true">
                {domain.mark}
              </span>
              <span>{domain.label}</span>
            </div>
          ))}
        </div>

        <p className="mystic-footer">
          适合整体运势、感情、事业、财运、梦境、面相、手相与空间风水咨询。
        </p>
      </div>
    </div>
  </section>
);
