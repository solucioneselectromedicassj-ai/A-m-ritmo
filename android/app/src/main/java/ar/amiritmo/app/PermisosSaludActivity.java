package ar.amiritmo.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

/** Pantalla que Health Connect abre desde "política de privacidad": explica qué datos lee la app y para qué. */
public class PermisosSaludActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        int pad = (int) (20 * getResources().getDisplayMetrics().density);
        LinearLayout caja = new LinearLayout(this);
        caja.setOrientation(LinearLayout.VERTICAL);
        caja.setPadding(pad, pad * 2, pad, pad);
        TextView titulo = new TextView(this);
        titulo.setText("A Mi Ritmo y Health Connect");
        titulo.setTextSize(22);
        titulo.setPadding(0, 0, 0, pad / 2);
        TextView texto = new TextView(this);
        texto.setTextSize(16);
        texto.setText(
            "A Mi Ritmo puede traer a tu registro la saturación de oxígeno y el pulso que guarda tu reloj o pulsera en Health Connect.\n\n" +
            "• Solo LEE esos dos datos. No escribe ni modifica nada en Health Connect.\n" +
            "• Los datos quedan únicamente en tu teléfono, dentro de la app. No se envían a ningún servidor ni se comparten.\n" +
            "• Podés quitar el permiso cuando quieras desde Health Connect.\n" +
            "• Son lecturas de un reloj o pulsera: no reemplazan un saturómetro ni la consulta con tu médico."
        );
        Button cerrar = new Button(this);
        cerrar.setText("Entendido");
        cerrar.setOnClickListener(v -> finish());
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        lp.gravity = Gravity.END;
        lp.topMargin = pad;
        caja.addView(titulo);
        caja.addView(texto);
        caja.addView(cerrar, lp);
        ScrollView sv = new ScrollView(this);
        sv.addView(caja);
        setContentView(sv);
    }
}
