import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// BUG-002: findBy*/waitFor default to 1s, which flakes under CPU contention.
configure({ asyncUtilTimeout: 5_000 });
