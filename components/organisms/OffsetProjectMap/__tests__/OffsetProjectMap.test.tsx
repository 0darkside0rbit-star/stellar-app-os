import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OffsetProjectMap, getProjectRegion, getProjectTypeColor } from '../OffsetProjectMap';
import { mockCarbonProjects } from '@/lib/api/mock/carbonProjects';
import type { CarbonProject } from '@/lib/types/carbon';

// Mock react-leaflet components
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, ...props }: any) => (
    <div data-testid="map-container" {...props}>
      {children}
    </div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  CircleMarker: ({ children, eventHandlers, ...props }: any) => (
    <div
      data-testid="circle-marker"
      onMouseEnter={eventHandlers?.mouseover}
      onMouseLeave={eventHandlers?.mouseout}
      {...props}
    >
      {children}
    </div>
  ),
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  useMap: () => ({
    flyTo: vi.fn(),
  }),
}));

// Mock leaflet
vi.mock('leaflet', () => ({
  default: {
    Icon: {
      Default: {
        prototype: { _getIconUrl: null },
        mergeOptions: vi.fn(),
      },
    },
  },
  Icon: {
    Default: {
      prototype: { _getIconUrl: null },
      mergeOptions: vi.fn(),
    },
  },
}));

describe('OffsetProjectMap Component', () => {
  it('renders interactive map with quick stats and markers', () => {
    render(<OffsetProjectMap projects={mockCarbonProjects} />);

    expect(screen.getByTestId('offset-project-map-container')).toBeDefined();
    expect(screen.getByTestId('map-container')).toBeDefined();
    expect(screen.getByTestId('active-projects-count').textContent).toBe(
      String(mockCarbonProjects.length)
    );

    // Circle markers rendered for projects
    const markers = screen.getAllByTestId('circle-marker');
    expect(markers.length).toBe(mockCarbonProjects.length);
  });

  it('filters projects by region when clicking region pills', () => {
    render(<OffsetProjectMap projects={mockCarbonProjects} />);

    // Click South America
    const southAmericaBtn = screen.getByRole('button', { name: /Filter region South America/i });
    fireEvent.click(southAmericaBtn);

    const southAmericaProjects = mockCarbonProjects.filter(
      (p) => getProjectRegion(p) === 'South America'
    );
    expect(screen.getByTestId('active-projects-count').textContent).toBe(
      String(southAmericaProjects.length)
    );

    // Click Africa
    const africaBtn = screen.getByRole('button', { name: /Filter region Africa/i });
    fireEvent.click(africaBtn);

    const africaProjects = mockCarbonProjects.filter((p) => getProjectRegion(p) === 'Africa');
    expect(screen.getByTestId('active-projects-count').textContent).toBe(
      String(africaProjects.length)
    );
  });

  it('filters projects by project type selector', () => {
    render(<OffsetProjectMap projects={mockCarbonProjects} />);

    const typeSelect = screen.getByLabelText(/Filter by project type/i);
    fireEvent.change(typeSelect, { target: { value: 'Renewable Energy' } });

    const renewableProjects = mockCarbonProjects.filter((p) => p.type === 'Renewable Energy');
    expect(screen.getByTestId('active-projects-count').textContent).toBe(
      String(renewableProjects.length)
    );
  });

  it('filters projects by availability selector', () => {
    render(<OffsetProjectMap projects={mockCarbonProjects} />);

    const availabilitySelect = screen.getByLabelText(/Filter by availability/i);

    // In stock only
    fireEvent.change(availabilitySelect, { target: { value: 'in_stock' } });
    const inStockProjects = mockCarbonProjects.filter(
      (p) => !p.isOutOfStock && p.availableSupply > 0
    );
    expect(screen.getByTestId('active-projects-count').textContent).toBe(
      String(inStockProjects.length)
    );

    // Out of stock only
    fireEvent.change(availabilitySelect, { target: { value: 'out_of_stock' } });
    const outOfStockProjects = mockCarbonProjects.filter(
      (p) => p.isOutOfStock || p.availableSupply <= 0
    );
    expect(screen.getByTestId('active-projects-count').textContent).toBe(
      String(outOfStockProjects.length)
    );
  });

  it('shows project details on hover over marker and clears on mouseout', () => {
    render(<OffsetProjectMap projects={mockCarbonProjects} />);

    const firstProject = mockCarbonProjects[0];
    const markers = screen.getAllByTestId('circle-marker');

    // Trigger hover
    fireEvent.mouseEnter(markers[0]);

    // Hover card appears with project details
    const hoverCard = screen.getByTestId('project-hover-card');
    expect(hoverCard).toBeDefined();
    expect(hoverCard.textContent).toContain(firstProject.name);
    expect(hoverCard.textContent).toContain(firstProject.location);
    expect(hoverCard.textContent).toContain(`$${firstProject.pricePerTon.toFixed(2)} USDC`);
    expect(hoverCard.textContent).toContain(String(firstProject.vintageYear));

    // Trigger mouseout
    fireEvent.mouseLeave(markers[0]);
    expect(screen.queryByTestId('project-hover-card')).toBeNull();
  });

  it('supports external filters prop correctly', () => {
    render(
      <OffsetProjectMap
        projects={mockCarbonProjects}
        filters={{
          types: ['Reforestation'],
          availableOnly: true,
        }}
      />
    );

    const expected = mockCarbonProjects.filter(
      (p) => p.type === 'Reforestation' && !p.isOutOfStock && p.availableSupply > 0
    );
    const markers = screen.getAllByTestId('circle-marker');
    expect(markers.length).toBe(expected.length);
  });

  it('resets all filters when clicking Reset button', () => {
    render(<OffsetProjectMap projects={mockCarbonProjects} />);

    // Apply a region filter
    const europeBtn = screen.getByRole('button', { name: /Filter region Europe/i });
    fireEvent.click(europeBtn);

    // Reset button should now be visible
    const resetBtn = screen.getByRole('button', { name: /Reset/i });
    fireEvent.click(resetBtn);

    expect(screen.getByTestId('active-projects-count').textContent).toBe(
      String(mockCarbonProjects.length)
    );
  });
});

describe('Helper functions', () => {
  it('correctly maps projects to regions', () => {
    const brazilProject: CarbonProject = {
      ...mockCarbonProjects[0],
      location: 'Amazon, Brazil',
    };
    expect(getProjectRegion(brazilProject)).toBe('South America');

    const kenyaProject: CarbonProject = {
      ...mockCarbonProjects[0],
      location: 'Nairobi, Kenya',
    };
    expect(getProjectRegion(kenyaProject)).toBe('Africa');

    const usaProject: CarbonProject = {
      ...mockCarbonProjects[0],
      location: 'California, USA',
    };
    expect(getProjectRegion(usaProject)).toBe('North America');

    const scotlandProject: CarbonProject = {
      ...mockCarbonProjects[0],
      location: 'Highlands, Scotland',
    };
    expect(getProjectRegion(scotlandProject)).toBe('Europe');

    const indonesiaProject: CarbonProject = {
      ...mockCarbonProjects[0],
      location: 'Sumatra, Indonesia',
    };
    expect(getProjectRegion(indonesiaProject)).toBe('Asia-Pacific');
  });

  it('returns distinct colors for different project types', () => {
    const reforest = getProjectTypeColor('Reforestation');
    const energy = getProjectTypeColor('Renewable Energy');
    const mangrove = getProjectTypeColor('Mangrove Restoration');
    const agri = getProjectTypeColor('Sustainable Agriculture');

    expect(reforest.fill).not.toBe(energy.fill);
    expect(mangrove.fill).not.toBe(agri.fill);
  });
});
