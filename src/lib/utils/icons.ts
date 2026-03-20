import {
  Utensils, Car, ShoppingBag, Gamepad2, Home, Heart,
  Smartphone, BookOpen, Zap, CreditCard, ArrowLeftRight,
  Banknote, Gift, RotateCcw, ArrowDownToLine, CircleDashed,
  Repeat, RefreshCw,
  Coffee, Wine, Baby, Shirt, Scissors, Dumbbell,
  Plane, Bus, Bike, Fuel, ParkingCircle,
  Dog, Cat, Music, Camera, Tv, Monitor,
  Wrench, Paintbrush, Glasses, Watch, Umbrella,
  Sparkles, Star, Flame, Leaf, Sun, Moon,
  Wallet, Landmark, TrendingUp, PiggyBank, Building2, CircleDollarSign,
  type LucideIcon
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Utensils, Car, ShoppingBag, Gamepad2, Home, Heart,
  Smartphone, BookOpen, Zap, CreditCard, ArrowLeftRight,
  Banknote, Gift, RotateCcw, ArrowDownToLine, CircleDashed,
  Repeat, RefreshCw,
  Coffee, Wine, Baby, Shirt, Scissors, Dumbbell,
  Plane, Bus, Bike, Fuel, ParkingCircle,
  Dog, Cat, Music, Camera, Tv, Monitor,
  Wrench, Paintbrush, Glasses, Watch, Umbrella,
  Sparkles, Star, Flame, Leaf, Sun, Moon,
  Wallet, Landmark, TrendingUp, PiggyBank, Building2, CircleDollarSign,
};

export const AVAILABLE_ICONS = Object.keys(iconMap);

export function getIcon(name: string): LucideIcon {
  return iconMap[name] || CircleDashed;
}
