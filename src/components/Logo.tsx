
import { useState, useEffect } from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  collapsed?: boolean;
  // Add prop to force white logo
  white?: boolean;
}

export function Logo({ size = "md", className = "", collapsed = false, white = false }: LogoProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    
    checkDark();
    
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    
    return () => observer.disconnect();
  }, []);

  const sizeClasses = {
    sm: "h-6",
    md: "h-8",
    lg: "h-12",
    xl: "h-16",
  };

  return (
    <img
      src={collapsed ? "/quanto-custa-favicon-2.png" : (white ? "/logo-light.png" : (isDark ? "/logo-light.png" : "/logo-dark.png"))}
      alt="Quanto Custa? Imobiliário"
      className={`${sizeClasses[size]} ${className} w-auto`}
    />
  );
}
