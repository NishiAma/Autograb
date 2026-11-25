import { VehicleSelectionForm } from './components/VehicleSelectionForm';

export function App() {
  return (
    <main className="container">
      <header>
        <h1>Vehicle Selection</h1>
        <p className="subtitle">Choose your vehicle and upload its service logbook.</p>
      </header>
      <VehicleSelectionForm />
    </main>
  );
}
