import { renderToStaticMarkup } from 'react-dom/server';
import { HeroSection } from '@/components/HeroSection';

describe('HeroSection', () => {
  it('renders the redesigned hero cards with eight aligned analysis domains', () => {
    const markup = renderToStaticMarkup(<HeroSection />);

    expect(markup).toContain('东方命理图谱');
    expect(markup).toContain('与东方命理知识体系');
    expect(markup).toContain('精准分析领域');
    expect(markup.match(/mystic-domain-item/g)).toHaveLength(8);
    expect(markup).toContain('空间风水');
  });
});
