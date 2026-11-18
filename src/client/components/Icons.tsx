import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function svg(paths: string[], props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export const Boxes = (p: IconProps) => svg(['M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z', 'm7 16.5-4.74-2.85', 'm7 16.5 5-3', 'M7 16.5v5.17', 'M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z', 'm17 16.5-5-3', 'm17 16.5 4.74-2.85', 'M17 16.5v5.17', 'M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z', 'M12 8 7.26 5.15', 'm12 8 4.74-2.85', 'M12 13.5V8'], p);
export const CheckCircle2 = (p: IconProps) => svg(['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'm9 12 2 2 4-4'], p);
export const CloudOff = (p: IconProps) => svg(['m2 2 20 20', 'M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193', 'M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07'], p);
export const Database = (p: IconProps) => svg(['M3 5a9 3 0 1 0 18 0A9 3 0 1 0 3 5Z', 'M3 12a9 3 0 0 0 18 0', 'M3 5v14a9 3 0 0 0 18 0V5'], p);
export const Edit3 = (p: IconProps) => svg(['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'], p);
export const FileCheck2 = (p: IconProps) => svg(['M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4', 'M14 2v4a2 2 0 0 0 2 2h4', 'm3 15 2 2 4-4'], p);
export const History = (p: IconProps) => svg(['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5', 'M12 7v5l4 2'], p);
export const Info = (p: IconProps) => svg(['M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z', 'M12 16v-4', 'M12 8h.01'], p);
export const Leaf = (p: IconProps) => svg(['M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z', 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12'], p);
export const Lock = (p: IconProps) => svg(['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z', 'M7 11V7a5 5 0 0 1 10 0v4'], p);
export const LogOut = (p: IconProps) => svg(['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'], p);
export const Minus = (p: IconProps) => svg(['M5 12h14'], p);
export const PackageCheck = (p: IconProps) => svg(['m16 16 2 2 4-4', 'M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14', 'm7.5 4.27 9 5.15', 'M3.29 7 12 12l8.71-5', 'M12 22V12'], p);
export const Plus = (p: IconProps) => svg(['M5 12h14', 'M12 5v14'], p);
export const QrCode = (p: IconProps) => svg(['M3 3h5v5H3z', 'M16 3h5v5h-5z', 'M3 16h5v5H3z', 'M21 16h-3a2 2 0 0 0-2 2v3', 'M21 21v.01', 'M12 7v3a2 2 0 0 1-2 2H7', 'M3 12h.01', 'M12 3h.01', 'M12 16v.01', 'M16 12h1', 'M21 12v.01', 'M12 21v-1'], p);
export const Receipt = (p: IconProps) => svg(['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z', 'M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8', 'M12 17.5v-11'], p);
export const RotateCcw = (p: IconProps) => svg(['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'], p);
export const ScrollText = (p: IconProps) => svg(['M15 12h-5', 'M15 8h-5', 'M19 17V5a2 2 0 0 0-2-2H4', 'M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3'], p);
export const Search = (p: IconProps) => svg(['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z', 'm21 21-4.3-4.3'], p);
export const ShieldCheck = (p: IconProps) => svg(['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'], p);
export const ShoppingBag = (p: IconProps) => svg(['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'], p);
export const ShoppingCart = (p: IconProps) => svg(['M8 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', 'M19 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', 'M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12'], p);
export const Store = (p: IconProps) => svg(['m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7', 'M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8', 'M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4', 'M2 7h20', 'M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7'], p);
export const Trash2 = (p: IconProps) => svg(['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2', 'M10 11v6', 'M14 11v6'], p);
export const UserCheck = (p: IconProps) => svg(['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'm16 11 2 2 4-4'], p);
export const UserPlus = (p: IconProps) => svg(['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 7a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z', 'M19 8v6', 'M22 11h-6'], p);
export const X = (p: IconProps) => svg(['M18 6 6 18', 'm6 6 12 12'], p);
