# ImageNerve Frontend - Modular Structure

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── GlassCard.tsx   # Glass morphism card component
│   ├── PhotoImage.tsx  # Photo display with loading states
│   └── index.ts        # Component exports
├── screens/            # Screen components
│   ├── SplashScreen.tsx
│   ├── LoginScreen.tsx
│   ├── OTPScreen.tsx
│   ├── DashboardScreen.tsx
│   ├── SettingsScreen.tsx
│   ├── SearchScreen.tsx
│   └── index.ts        # Screen exports
├── navigation/         # Navigation components
│   ├── AppNavigator.tsx
│   ├── MainTabNavigator.tsx
│   └── index.ts        # Navigation exports
├── services/           # API services
│   └── api.ts
├── types/              # TypeScript type definitions
│   └── index.ts
├── utils/              # Utility functions
│   └── imageUtils.ts
└── README.md           # This file
```

## 🎨 Design System

### Glass Morphism Components
- **GlassCard**: Reusable glass effect container
- **Consistent styling**: All components use the same glass morphism effects
- **Responsive design**: Adapts to different screen sizes

### Color Palette
- **Primary Background**: `#0f3460` (Deep Navy)
- **Secondary Background**: `#1a1a2e` (Dark Blue-Gray)
- **Accent Color**: `#e94560` (Coral Red)
- **Text Primary**: `#ffffff` (Pure White)
- **Text Secondary**: `rgba(255, 255, 255, 0.7)` (Light Gray)

## 🧩 Components

### GlassCard
Reusable glass morphism container with optional touch functionality.

```typescript
<GlassCard style={customStyle} onPress={handlePress}>
  <Text>Content</Text>
</GlassCard>
```

### PhotoImage
Enhanced photo display component with loading states and error handling.

```typescript
<PhotoImage photo={photoData} />
```

## 📱 Screens

### SplashScreen
- Animated splash screen with scale and fade effects
- Auto-navigates to Login after 2 seconds

### LoginScreen
- Phone number input with glass morphism
- Form validation and loading states

### OTPScreen
- 4-digit OTP input with individual boxes
- Verification with loading feedback

### DashboardScreen
- Photo grid with responsive layout
- Upload functionality with face detection
- Loading and empty states

### SettingsScreen
- User profile display
- Face clustering functionality
- Logout button

### SearchScreen
- Search input with glass effects
- Relevant search suggestions

## 🧭 Navigation

### AppNavigator
Stack navigator for authentication flow:
- Splash → Login → OTP → MainApp

### MainTabNavigator
Bottom tab navigator for main app:
- Dashboard (🏠)
- Search (🔍)
- Settings (⚙️)

## 🔧 Development

### Adding New Components
1. Create component in `src/components/`
2. Export from `src/components/index.ts`
3. Import where needed

### Adding New Screens
1. Create screen in `src/screens/`
2. Export from `src/screens/index.ts`
3. Add to navigation if needed

### Styling Guidelines
- Use glass morphism effects consistently
- Follow the established color palette
- Implement responsive design
- Add loading and error states

## 🚀 Benefits of Modular Structure

1. **Scalability**: Easy to add new features
2. **Maintainability**: Clear separation of concerns
3. **Reusability**: Components can be shared across screens
4. **Testing**: Individual components can be tested in isolation
5. **Performance**: Better code splitting and lazy loading
6. **Team Development**: Multiple developers can work on different components

## 📋 Best Practices

- Keep components focused and single-purpose
- Use TypeScript interfaces for props
- Implement proper error boundaries
- Add loading states for async operations
- Follow consistent naming conventions
- Document complex logic with comments 