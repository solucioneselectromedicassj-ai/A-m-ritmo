package ar.amiritmo.app;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.common.api.ApiException;

/**
 * Ingreso opcional con la cuenta de Google del teléfono. Pide solo el mail y el perfil básico (nombre);
 * no usa servidor propio ni pide permisos sobre Drive u otros datos.
 */
@CapacitorPlugin(name = "GoogleLogin")
public class GoogleLoginPlugin extends Plugin {

    private GoogleSignInClient cliente() {
        GoogleSignInOptions opciones = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN).requestEmail().build();
        return GoogleSignIn.getClient(getActivity(), opciones);
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        try {
            startActivityForResult(call, cliente().getSignInIntent(), "resultado");
        } catch (Exception e) {
            call.reject("No se pudo abrir el ingreso con Google: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void resultado(PluginCall call, ActivityResult resultado) {
        if (call == null) return;
        Intent datos = resultado.getData();
        try {
            GoogleSignInAccount cuenta = GoogleSignIn.getSignedInAccountFromIntent(datos).getResult(ApiException.class);
            JSObject r = new JSObject();
            r.put("nombre", cuenta.getDisplayName() == null ? "" : cuenta.getDisplayName());
            r.put("email", cuenta.getEmail() == null ? "" : cuenta.getEmail());
            call.resolve(r);
        } catch (ApiException e) {
            call.reject(e.getStatusCode() == 12501 ? "cancelado" : "Error de Google (" + e.getStatusCode() + ")", String.valueOf(e.getStatusCode()));
        } catch (Exception e) {
            call.reject("No se pudo entrar con Google: " + e.getMessage());
        }
    }

    @PluginMethod
    public void signOut(PluginCall call) {
        cliente().signOut().addOnCompleteListener(t -> call.resolve());
    }
}
