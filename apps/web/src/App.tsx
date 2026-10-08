import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { InventoryPage } from "./pages/InventoryPage";
import { ProductsPage } from "./pages/ProductsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ReceivingPage } from "./pages/ReceivingPage";
import { LocationsPage } from "./pages/LocationsPage";
import { CycleCountsPage } from "./pages/CycleCountsPage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/receiving" element={<ReceivingPage />} />
          <Route path="/locations" element={<LocationsPage />} />
          <Route path="/cycle-counts" element={<CycleCountsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
