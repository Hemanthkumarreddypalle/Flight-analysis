import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { Navigate, createBrowserRouter, RouterProvider } from "react-router-dom";
import AppRouteError from "./AppRouteError";
import StartupErrorBoundary from "./StartupErrorBoundary";
import "./index.css";

const AircraftPage = React.lazy(() => import("./pages/AircraftPage"));
const AirportsPage = React.lazy(() => import("./pages/AirportsPage"));
const AuthCallback = React.lazy(() => import("./AuthCallback"));
const AuthStart = React.lazy(() => import("./AuthStart"));
const AuthenticatedRoute = React.lazy(() => import("./AuthenticatedRoute"));
const FlightsPage = React.lazy(() => import("./pages/FlightsPage"));
const HomePage = React.lazy(() => import("./pages/HomePage"));
const RoutesPage = React.lazy(() => import("./pages/RoutesPage"));

const router = createBrowserRouter(
  [
    {
      path: "/",
      errorElement: <AppRouteError />,
      element: (
        <Suspense fallback={<div>Loading route...</div>}>
          <AuthenticatedRoute />
        </Suspense>
      ),
      children: [
        {
          path: "/",
          element: (
            <Suspense fallback={<div>Loading home page...</div>}>
              <HomePage />
            </Suspense>
          ),
        },
        {
          path: "airports",
          element: (
            <Suspense fallback={<div>Loading airports page...</div>}>
              <AirportsPage />
            </Suspense>
          ),
        },
        {
          path: "routes",
          element: (
            <Suspense fallback={<div>Loading routes page...</div>}>
              <RoutesPage />
            </Suspense>
          ),
        },
        {
          path: "flights",
          element: (
            <Suspense fallback={<div>Loading flights page...</div>}>
              <FlightsPage />
            </Suspense>
          ),
        },
        {
          path: "aircraft",
          element: (
            <Suspense fallback={<div>Loading aircraft page...</div>}>
              <AircraftPage />
            </Suspense>
          ),
        },
      ],
    },
    {
      path: "/auth/start",
      errorElement: <AppRouteError />,
      element: (
        <Suspense fallback={<div>Starting authentication...</div>}>
          <AuthStart />
        </Suspense>
      ),
    },
    {
      // This is the route defined in your application's redirect URL
      path: "/auth/callback/*",
      errorElement: <AppRouteError />,
      element: (
        <Suspense fallback={<div>Loading authentication...</div>}>
          <AuthCallback />
        </Suspense>
      ),
    },
    {
      path: "*",
      element: <Navigate to="/" replace={true} />,
    },
  ],
  { basename: import.meta.env.BASE_URL },
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StartupErrorBoundary>
    <RouterProvider router={router} />
  </StartupErrorBoundary>,
);
