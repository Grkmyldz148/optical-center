import type { NextConfig } from 'next';
import withOpticalCenter from 'optical-center/next';

const nextConfig: NextConfig = {
  // React Compiler stays on — the optical-center loader runs before SWC and
  // hands the JSX back untouched, so nothing here is opted out of SWC.
  reactStrictMode: true,
};

export default withOpticalCenter(nextConfig, {
  // Correct the local demo Iconify collection imported by the page. The
  // `include` fragment is matched against the resolved module path.
  iconData: { include: ['demo-icons'] },
  // Exercise the icon-data rewrite under Turbopack too (off by default).
  turbopackIconData: true,
});
