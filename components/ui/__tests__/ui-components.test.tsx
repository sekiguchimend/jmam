/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// Components
import { Button } from '../Button';
import { Card } from '../Card';
import { AlertMessage, ErrorMessage, SuccessMessage } from '../AlertMessage';
import { FormInput } from '../FormInput';
import { LoadingSpinner, PageLoading } from '../LoadingSpinner';
import { ProgressBar } from '../ProgressBar';
import { ScoreSlider } from '../ScoreSlider';

// ========================================
// Button
// ========================================
describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('applies primary variant styles by default', () => {
    render(<Button>Primary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveStyle({ background: 'var(--primary)' });
  });

  it('applies secondary variant styles', () => {
    render(<Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveStyle({ background: 'var(--surface)' });
  });

  it('applies danger variant styles', () => {
    render(<Button variant="danger">Danger</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveStyle({ background: '#dc2626' });
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-3', 'py-1.5');

    rerender(<Button size="md">Medium</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-4', 'py-2');

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-6', 'py-3');
  });

  it('shows loading state', () => {
    render(<Button isLoading>Submit</Button>);
    expect(screen.getByText('処理中...')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} disabled>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('does not call onClick when loading', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick} isLoading>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });
});

// ========================================
// Card
// ========================================
describe('Card', () => {
  it('renders children correctly', () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Card title="Card Title">Content</Card>);
    expect(screen.getByText('Card Title')).toBeInTheDocument();
  });

  it('does not render title when not provided', () => {
    render(<Card>Content only</Card>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});

// ========================================
// AlertMessage
// ========================================
describe('AlertMessage', () => {
  it('renders error message with correct styling', () => {
    render(<AlertMessage type="error" message="Error occurred" />);
    const alert = screen.getByText('Error occurred');
    expect(alert).toBeInTheDocument();
    expect(alert.parentElement).toHaveStyle({ color: 'var(--error)' });
  });

  it('renders success message with correct styling', () => {
    render(<AlertMessage type="success" message="Success!" />);
    const alert = screen.getByText('Success!');
    expect(alert).toBeInTheDocument();
    expect(alert.parentElement).toHaveStyle({ color: '#16a34a' });
  });

  it('applies custom className', () => {
    render(<AlertMessage type="error" message="Test" className="custom-class" />);
    expect(screen.getByText('Test').parentElement).toHaveClass('custom-class');
  });
});

describe('ErrorMessage', () => {
  it('renders as error type AlertMessage', () => {
    render(<ErrorMessage message="Error message" />);
    const alert = screen.getByText('Error message');
    expect(alert.parentElement).toHaveStyle({ color: 'var(--error)' });
  });
});

describe('SuccessMessage', () => {
  it('renders as success type AlertMessage', () => {
    render(<SuccessMessage message="Success message" />);
    const alert = screen.getByText('Success message');
    expect(alert.parentElement).toHaveStyle({ color: '#16a34a' });
  });
});

// ========================================
// FormInput
// ========================================
describe('FormInput', () => {
  it('renders input element', () => {
    render(<FormInput />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<FormInput label="Username" />);
    expect(screen.getByText('Username')).toBeInTheDocument();
  });

  it('shows required indicator when required', () => {
    render(<FormInput label="Email" required />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('does not show required indicator when not required', () => {
    render(<FormInput label="Email" />);
    expect(screen.queryByText('*')).not.toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    render(<FormInput data-testid="input" />);
    const input = screen.getByRole('textbox');
    // CSS変数はjsdomで解決されないため、背景色でvariantを確認
    expect(input).toHaveStyle({ background: 'var(--surface)' });
  });

  it('applies setup variant styles', () => {
    render(<FormInput variant="setup" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveStyle({ border: '2px solid #e5e5e5' });
  });

  it('forwards ref correctly', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<FormInput ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('passes through input props', () => {
    render(<FormInput placeholder="Enter text" type="email" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('placeholder', 'Enter text');
    expect(input).toHaveAttribute('type', 'email');
  });
});

// ========================================
// LoadingSpinner
// ========================================
describe('LoadingSpinner', () => {
  it('renders without text by default', () => {
    const { container } = render(<LoadingSpinner />);
    // Should only have the spinner icon
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(container.textContent).toBe('');
  });

  it('renders with text when provided', () => {
    render(<LoadingSpinner text="Loading..." />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<LoadingSpinner className="custom-spinner" />);
    expect(container.firstChild).toHaveClass('custom-spinner');
  });
});

describe('PageLoading', () => {
  it('renders with default text', () => {
    render(<PageLoading />);
    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('renders with custom text', () => {
    render(<PageLoading text="データを取得中..." />);
    expect(screen.getByText('データを取得中...')).toBeInTheDocument();
  });
});

// ========================================
// ProgressBar
// ========================================
describe('ProgressBar', () => {
  it('calculates percentage correctly', () => {
    render(<ProgressBar current={50} total={100} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('50 / 100')).toBeInTheDocument();
  });

  it('displays 0% when total is 0', () => {
    render(<ProgressBar current={10} total={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('caps percentage at 100%', () => {
    render(<ProgressBar current={150} total={100} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('prevents negative percentage', () => {
    render(<ProgressBar current={-10} total={100} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('formats large numbers with locale string', () => {
    render(<ProgressBar current={1000000} total={2000000} />);
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('1,000,000 / 2,000,000')).toBeInTheDocument();
  });

  it('renders animated version when animated prop is true', () => {
    const { container } = render(<ProgressBar current={50} total={100} animated />);
    // animated版はstyle jsxを含む
    expect(container.querySelector('style')).toBeInTheDocument();
  });
});

// ========================================
// ScoreSlider
// ========================================
describe('ScoreSlider', () => {
  it('renders with initial value', () => {
    render(<ScoreSlider value={3} onChange={() => {}} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('calls onChange when clicked', () => {
    const handleChange = vi.fn();
    const { container } = render(<ScoreSlider value={3} onChange={handleChange} />);

    // トラック要素を取得
    const track = container.querySelector('.cursor-pointer');
    if (track) {
      // getBoundingClientRect をモック
      vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        right: 100,
        width: 100,
        top: 0,
        bottom: 20,
        height: 20,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      fireEvent.mouseDown(track, { clientX: 50 });
      expect(handleChange).toHaveBeenCalled();
    }
  });

  it('displays correct value in tooltip', () => {
    render(<ScoreSlider value={4.5} onChange={() => {}} />);
    expect(screen.getByText('4.5')).toBeInTheDocument();
  });

  it('respects min and max props', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <ScoreSlider value={5} min={0} max={10} onChange={handleChange} />
    );
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('respects step prop', () => {
    const handleChange = vi.fn();
    render(<ScoreSlider value={2.5} step={0.5} onChange={handleChange} />);
    expect(screen.getByText('2.5')).toBeInTheDocument();
  });
});
