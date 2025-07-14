import { useToast } from "@/components/ui/use-toast";

const DEFAULT_SUCCESS_DURATION = 3000; // 3 seconds

export function useAppToast() {
  const { toast } = useToast();

  const showSuccessToast = (message: string, duration: number = DEFAULT_SUCCESS_DURATION) => {
    toast({
      // Omitting title for a cleaner look as per common modern toast design
      // title: "Success", 
      description: message,
      duration: duration,
      className: "bg-pistachiomist text-charcoalcocoa"
    });
  };

  const showInfoToast = (message: string) => {
    toast({
      // Omitting title for info as well
      // title: "Info",
      description: message,
      duration: Infinity,
      className: "bg-background text-charcoalcocoa"
    });
  };

  // Placeholder for error toasts to be implemented later
  // const showErrorToast = (title: string, message: string) => {
  //   toast({
  //     variant: "destructive", // shadcn/ui often has a 'destructive' variant
  //     title: title,
  //     description: message,
  //     action: <ToastAction altText="Dismiss">Dismiss</ToastAction>, // Manual dismiss
  //     duration: Infinity, // Effectively manual dismiss by not auto-hiding
  //   });
  // };

  return { showSuccessToast, showInfoToast /*, showErrorToast */ };
} 