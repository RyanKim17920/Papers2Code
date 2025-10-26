# Frontend Architecture

Modern, feature-based architecture for the Papers2Code frontend.

## Structure

```
src/
├── features/              # Feature-based modules (pages + components)
│   ├── auth/             # Authentication & error pages
│   ├── dashboard/        # Dashboard feature
│   ├── landing/          # Landing page
│   ├── paper-detail/     # Paper detail view
│   ├── paper-list/       # Paper listing & search
│   └── profile/          # User profiles
├── shared/               # Shared/reusable code
│   ├── components/       # Shared UI components
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom hooks
│   ├── services/         # API services
│   ├── types/            # TypeScript types
│   ├── ui/               # UI library components (shadcn/ui)
│   └── utils/            # Utility functions
├── styles/               # Global styles
│   ├── App.css
│   └── index.css
├── assets/               # Static assets
├── App.tsx               # Root component
└── main.tsx              # Entry point
```

## Architecture Principles

### 1. Feature-Based Organization
Each feature is self-contained with its page, components, and feature-specific logic.

**Benefits:**
- Easy to find related code
- Clear feature boundaries
- Scalable as app grows
- Can be split into micro-frontends later

### 2. Shared Code Separation
Common code lives in `shared/` with clear categories:
- **components**: Reusable UI components
- **hooks**: Custom React hooks
- **services**: API clients and external services
- **types**: TypeScript type definitions
- **utils**: Pure utility functions
- **ui**: Third-party UI library components

### 3. Import Path Conventions

Use absolute imports with `@/` prefix:

```typescript
// ✅ Good - absolute imports
import { DashboardPage } from '@/features/dashboard';
import { GlobalHeader } from '@/shared/components';
import { usePaperList } from '@/shared/hooks';

// ❌ Avoid - relative imports across features
import { SomeComponent } from '../../../shared/components/SomeComponent';
```

### 4. Barrel Exports

Each major directory has an `index.ts` for cleaner imports:

```typescript
// Instead of:
import DashboardPage from '@/features/dashboard/DashboardPage';
import LoadingDashboard from '@/features/dashboard/LoadingDashboard';

// Use:
import { DashboardPage, LoadingDashboard } from '@/features/dashboard';
```

## Feature Structure

Each feature follows this pattern:

```
features/[feature-name]/
├── index.ts              # Barrel exports
├── [Feature]Page.tsx     # Main page component
├── Component1.tsx        # Feature-specific components
├── Component2.tsx
└── subfolder/            # Complex features may have subfolders
    └── ...
```

## Migration from Old Structure

**Before:**
```
src/
├── common/              # Shared utilities (mixed)
├── components/          # All components (flat)
├── pages/               # All pages (flat)
└── lib/                 # Utils (duplicate of common/utils)
```

**After:**
```
src/
├── features/            # Feature modules
├── shared/              # Shared code (organized)
└── styles/              # Styles (organized)
```

**Changes:**
- `common/*` → `shared/*` (clearer naming)
- `components/common` + `common/components` → `shared/components` (consolidated)
- `pages/` → `features/*/Page.tsx` (colocated with feature)
- `lib/` → `shared/utils` (consolidated)
- `*.css` → `styles/` (organized)

## Adding New Features

1. Create feature directory: `features/new-feature/`
2. Add page component: `NewFeaturePage.tsx`
3. Add feature components as needed
4. Create `index.ts` for exports
5. Add route in `App.tsx`

## Best Practices

### Component Organization
- Keep feature components in feature folders
- Only put truly reusable components in `shared/components`
- Use subfolder for complex component groups

### Import Organization
```typescript
// 1. External imports
import React from 'react';
import { useNavigate } from 'react-router-dom';

// 2. Shared imports
import { GlobalHeader } from '@/shared/components';
import { usePaperList } from '@/shared/hooks';
import type { Paper } from '@/shared/types';

// 3. Feature imports
import { ModernPaperCard } from './ModernPaperCard';
```

### Type Definitions
- Shared types → `shared/types/`
- Feature-specific types → define in the feature file
- API response types → `shared/types/` or `shared/services/api.ts`

## Benefits of This Structure

1. **Scalability**: Easy to add new features without cluttering
2. **Maintainability**: Related code is colocated
3. **Discoverability**: Clear where to find things
4. **Team Collaboration**: Features can be worked on independently
5. **Code Splitting**: Ready for route-based code splitting
6. **Testing**: Easy to test features in isolation

## Next Steps

Consider adding:
- Feature-specific `hooks/` subdirectories for complex features
- Feature-specific `types/` for domain models
- Feature-specific `utils/` for feature-specific helpers
- Storybook for component documentation
