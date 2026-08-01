import { Tabs } from 'expo-router';

/**
 * Exactly two tabs — Inicio and Transacciones (spec AC14, Deferral Note 2, resolved).
 * No Presupuestos or Beneficios tab, not even disabled: this item creates no route for
 * either destination. Final labels, icons and styling belong to the tab-shell item.
 */
export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="home" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transacciones' }} />
    </Tabs>
  );
}
