'use client';

import { useEffect } from 'react';

export default function ErrorTest() {
  useEffect(() => {
    // This will throw an error when the component mounts
    throw new Error('This is a test error');
  }, []);

  return (
    <div>
      <h1>Error Test Page</h1>
      <p>This page should throw an error...</p>
    </div>
  );
}
