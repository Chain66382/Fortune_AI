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

const consultationHighlights = [
  {
    mark: '易',
    title: '多体系交叉参照',
    description: '综合《易经》、六十四卦、梅花易数、风水、梦境、面相手相与星座资料。'
  },
  {
    mark: '辨',
    title: '按资料逐步深入',
    description: '先依据基本信息进入对话，需要照片或空间图时，再明确告诉你该怎么补。'
  },
  {
    mark: '析',
    title: '围绕问题持续判断',
    description: '适合运势、感情、事业、财运、梦境与空间风水等咨询方向。'
  }
];

const trigramMarks = [
  { label: '乾', className: 'mystic-trigram mystic-trigram-top' },
  { label: '巽', className: 'mystic-trigram mystic-trigram-top-right' },
  { label: '离', className: 'mystic-trigram mystic-trigram-right' },
  { label: '坤', className: 'mystic-trigram mystic-trigram-bottom' },
  { label: '艮', className: 'mystic-trigram mystic-trigram-bottom-left' },
  { label: '震', className: 'mystic-trigram mystic-trigram-left' },
  { label: '坎', className: 'mystic-trigram mystic-trigram-top-left' },
  { label: '兑', className: 'mystic-trigram mystic-trigram-bottom-right' }
];

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
          <div className="mystic-mantra" aria-hidden="true">
            <span>天</span>
            <span>人</span>
            <span>合</span>
            <span>一</span>
            <span className="mystic-mantra-divider" />
            <span>阴</span>
            <span>阳</span>
            <span>平</span>
            <span>衡</span>
          </div>

          <div className="mystic-diagram" aria-hidden="true">
            {trigramMarks.map((trigram) => (
              <span key={trigram.label} className={trigram.className}>
                {trigram.label}
              </span>
            ))}

            <svg viewBox="0 0 360 360" className="oracle-bagua">
              <circle cx="180" cy="180" r="136" className="bagua-ring" />
              <circle cx="180" cy="180" r="101" className="bagua-ring bagua-ring-soft" />
              <circle cx="180" cy="180" r="65" className="bagua-core" />
              <path
                d="M180 79a101 101 0 0 1 0 202 50.5 50.5 0 0 0 0-101 50.5 50.5 0 0 1 0-101Z"
                className="bagua-yin"
              />
              <path
                d="M180 79a50.5 50.5 0 0 1 0 101 50.5 50.5 0 0 0 0 101 101 101 0 0 1 0-202Z"
                className="bagua-yang"
              />
              <circle cx="180" cy="130" r="12" className="bagua-dot-light" />
              <circle cx="180" cy="230" r="12" className="bagua-dot-dark" />
              {Array.from({ length: 8 }, (_, index) => {
                const angle = index * 45;
                return (
                  <g key={angle} transform={`rotate(${angle} 180 180)`}>
                    <rect x="164" y="10" width="32" height="7" rx="3.5" className="trigram-bar" />
                    <rect x="164" y="25" width="32" height="7" rx="3.5" className="trigram-bar" />
                    <rect x="164" y="40" width="13" height="7" rx="3.5" className="trigram-bar" />
                    <rect x="183" y="40" width="13" height="7" rx="3.5" className="trigram-bar" />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="mystic-wisdom">
            <h3>命理知识 · 交叉参照</h3>
            <ul>
              <li>参考《易经》《周易六十四卦全解》与《梅花易数》的变化判断。</li>
              <li>结合风水基础、空间格局、阴阳五行与卦象线索分析问题。</li>
              <li>可延展到梦境、面相、手相与关系、事业、财运等具体方向。</li>
              <li>回答会综合个人背景信息与当前对话上下文，不只看单一句子。</li>
            </ul>
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

    <div className="hero-card">
      <div className="consult-card">
        <span className="consult-corner consult-corner-top-left" aria-hidden="true" />
        <span className="consult-corner consult-corner-top-right" aria-hidden="true" />
        <span className="consult-corner consult-corner-bottom-left" aria-hidden="true" />
        <span className="consult-corner consult-corner-bottom-right" aria-hidden="true" />
        <span className="consult-badge">Fortune AI</span>

        <div className="consult-copy">
          <h1>
            与东方命理知识体系
            <br />
            一对一深度咨询
          </h1>
          <p>
            系统会结合你填写的基础信息、当前困惑与对话上下文，参考《易经》《周易六十四卦全解》
            《梅花易数》、风水、梦境、面相手相与星座资料，给出结构化回应。
          </p>
        </div>

        <div className="consult-highlights">
          {consultationHighlights.map((item) => (
            <div key={item.title} className="consult-highlight-item">
              <span className="consult-highlight-mark" aria-hidden="true">
                {item.mark}
              </span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="consult-table">
          <span className="consult-table-glow consult-table-glow-left" aria-hidden="true" />
          <span className="consult-table-glow consult-table-glow-right" aria-hidden="true" />
          <span className="consult-flame" aria-hidden="true" />
        </div>
      </div>
    </div>
  </section>
);
