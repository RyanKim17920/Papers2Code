import { useState, useEffect, ReactElement, cloneElement } from 'react';

/**
 * A hook to measure the rendered height of a component.
 * It renders the component off-screen, measures its height, and returns the value.
 * This is useful for sizing skeletons or placeholders to prevent layout shift.
 *
 * @param component - The React component to measure.
 * @param dependencies - A dependency array to trigger remeasurement.
 * @returns The measured height of the component in pixels, or null if not measured yet.
 */
export const useComponentHeight = (component: ReactElement, dependencies: any[] = []): number | null => {
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    // Create a wrapper element to render the component off-screen
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = '-9999px';
    wrapper.style.left = '-9999px';
    wrapper.style.visibility = 'hidden';
    document.body.appendChild(wrapper);

    // We need to use a dynamic import for ReactDOM.createRoot
    // because this is a library file and doesn't have direct access to the main app's ReactDOM.
    import('react-dom/client').then(ReactDOM => {
      const root = ReactDOM.createRoot(wrapper);
      
      // Clone the element to avoid issues with reusing the same element instance
      const elementToMeasure = cloneElement(component);

      // Render the component, then measure its height
      root.render(elementToMeasure);

      // Use a short delay to allow for rendering and layout calculation
      setTimeout(() => {
        const measuredHeight = wrapper.clientHeight;
        setHeight(measuredHeight);

        // Clean up: unmount the component and remove the wrapper
        root.unmount();
        document.body.removeChild(wrapper);
      }, 100); // A small delay is often necessary for complex components
    });

    // Cleanup function in case the hook unmounts before measurement is complete
    return () => {
      const stillExists = document.body.contains(wrapper);
      if (stillExists) {
        document.body.removeChild(wrapper);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies]);

  return height;
};
