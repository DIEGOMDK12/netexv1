import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StoreProvider } from "@/lib/store-context";
import { Footer } from "@/components/footer";
import Home from "@/pages/home";
import ProductDetails from "@/pages/product-details";
import AdminLogin from "@/pages/admin-login";
import Admin from "@/pages/admin";
import MyOrders from "@/pages/my-orders";
import VendorRegister from "@/pages/vendor-register";
import VendorLogin from "@/pages/vendor-login";
import VendorDashboard from "@/pages/vendor-dashboard";
import SubscriptionPayment from "@/pages/subscription-payment";
import SubscriptionSuccess from "@/pages/subscription-success";
import ResellerStore from "@/pages/reseller-store";
import ResellerProductDetails from "@/pages/reseller-product-details";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/product/:id" component={ProductDetails} />
      <Route path="/pedidos" component={MyOrders} />
      <Route path="/admin" component={AdminLogin} />
      <Route path="/admin/dashboard" component={Admin} />
      <Route path="/admin/home" component={Admin} />
      <Route path="/register" component={VendorRegister} />
      <Route path="/login" component={VendorLogin} />
      <Route path="/subscription-payment" component={SubscriptionPayment} />
      <Route path="/subscription-success" component={SubscriptionSuccess} />
      <Route path="/vendor/dashboard" component={VendorDashboard} />
      <Route path="/vendor/:page" component={VendorDashboard} />
      <Route path="/loja/:slug" component={ResellerStore} />
      <Route path="/loja/:slug/produto/:productId" component={ResellerProductDetails} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StoreProvider>
          <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#121212" }}>
            <div className="flex-1">
              <Toaster />
              <Router />
            </div>
            <Footer />
          </div>
        </StoreProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
