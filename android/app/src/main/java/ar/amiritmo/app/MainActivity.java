package ar.amiritmo.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.JavascriptInterface;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Alto (en dp = px de CSS) de la barra de estado / muesca: la app se dibuja detrás y el título necesita dejarle lugar.
    private volatile float topDp = 0f;

    public class InsetsJs {
        @JavascriptInterface
        public float top() {
            return topDp;
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(StepCounterPlugin.class);
        super.onCreate(savedInstanceState);
        final float density = getResources().getDisplayMetrics().density;
        View raiz = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(raiz, (v, insets) -> {
            Insets barras = insets.getInsets(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.displayCutout());
            topDp = barras.top / density;
            return ViewCompat.onApplyWindowInsets(v, insets);
        });
        ViewCompat.requestApplyInsets(raiz);
        getBridge().getWebView().addJavascriptInterface(new InsetsJs(), "AndroidInsets");
    }
}
