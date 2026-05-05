import {
  AtSign as Instagram,
  ArrowRight,
  CircleUserRound as Facebook,
  Camera,
  CheckCircle2,
  Clock,
  Droplets,
  Globe as Linkedin,
  HardHat,
  Mail,
  MapPin,
  PaintbrushVertical,
  Phone,
  Send as Twitter,
  ShieldCheck,
  Zap,
  type LucideProps,
} from "lucide-react";

// Map string name → component so data.ts stays serialisable
const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  Zap,
  ShieldCheck,
  Droplets,
  Camera,
  PaintbrushVertical,
  HardHat,
  MapPin,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  ArrowRight,
  Linkedin,
  Facebook,
  Instagram,
  Twitter,
};

export const Icon = ({
  name,
  className,
  size = 24,
}: {
  name: string;
  className?: string;
  size?: number;
}) => {
  const Comp = ICON_MAP[name];
  if (!Comp) return null;
  return <Comp className={className} size={size} />;
};

// Direct re-exports for inline use
export {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Droplets,
  HardHat,
  Mail,
  MapPin,
  PaintbrushVertical,
  Phone,
  ShieldCheck,
  Zap,
};
