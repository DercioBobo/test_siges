// Copyright (c) 2024, EntreTech and contributors
// For license information, please see license.txt

const _FINANCIAL_COLORS = {
    "Regular":           "green",
    "Em Dívida":         "yellow",
    "Em Dívida Crítica": "orange",
    "Suspenso":          "red",
};

const _ALERT_MESSAGES = {
    1: "Pagamento em atraso",
    2: "Multa significativa aplicada",
    3: "Risco de suspensão",
    4: "Aluno elegível para suspensão",
};

frappe.ui.form.on("Student", {
    refresh(frm) {
        if (!frm.is_new()) {
            const current_status = frm.doc.current_status;

            _render_modern_header(frm);
            _set_financial_indicator(frm);
            _load_financial_summary(frm);

            if (current_status === "Transferido" || current_status === "Desistente") {
                frm.add_custom_button(
                    __("Reactivar Aluno"),
                    () => reactivate_dialog(frm),
                    __("Acções")
                );
            }

            frm.add_custom_button(
                __("Registar Transferência"),
                () => frappe.new_doc("Student Transfer", { student: frm.doc.name }),
                __("Acções")
            );

            frm.add_custom_button(
                __("Actualizar Estado Financeiro"),
                () => {
                    frappe.call({
                        method: "escola.escola.doctype.billing_cycle.penalty.update_student_financial_status",
                        args: { student_name: frm.doc.name },
                        freeze: true,
                        freeze_message: __("A calcular estado financeiro..."),
                        callback(r) {
                            if (r.exc) return;
                            frm.reload_doc();
                        },
                    });
                },
                __("Acções")
            );

            frm.add_custom_button(
                __("Ver Transferências"),
                () => frappe.set_route("List", "Student Transfer", { student: frm.doc.name }),
                __("Ver")
            );

            frm.add_custom_button(
                __("Ver Facturas"),
                () => frappe.set_route("List", "Sales Invoice", { escola_student: frm.doc.name }),
                __("Ver")
            );
        }
    },

    first_name(frm) { update_full_name(frm); },
    last_name(frm)  { update_full_name(frm); },
});

// ---------------------------------------------------------------------------
// Financial status helpers
// ---------------------------------------------------------------------------

function _set_financial_indicator(frm) {
    const status = frm.doc.financial_status || "Regular";
    const color  = _FINANCIAL_COLORS[status] || "gray";
    frm.page.set_indicator(__(status), color);
}

function _load_financial_summary(frm) {
    frappe.call({
        method: "escola.escola.doctype.billing_cycle.penalty.get_student_financial_summary",
        args: { student_name: frm.doc.name },
        callback(r) {
            if (r.exc || !r.message) return;
            const d = r.message;

            if (d.alert_level === 0) {
                frm.dashboard.set_headline("");
                return;
            }

            const color = _FINANCIAL_COLORS[d.financial_status] || "gray";
            const alert_text = __(_ALERT_MESSAGES[d.alert_level] || "");

            const html_parts = [
                `<b style="color:var(--${color}-600)">${alert_text}</b>`,
                __("Em dívida: <b>{0}</b>", [format_currency(d.total_outstanding)]),
            ];

            if (d.penalty_rate > 0) {
                html_parts.push(__("Multa: {0}% = {1}", [d.penalty_rate, format_currency(d.penalty_amount)]));
            }
            if (d.days_overdue > 0) {
                html_parts.push(__("{0} dias em atraso", [d.days_overdue]));
            }
            if (d.total_with_penalty > d.total_outstanding) {
                html_parts.push(__("Total com multa: <b>{0}</b>", [format_currency(d.total_with_penalty)]));
            }

            const header_alert = `
                <div style="background: var(--red-50, #FCEEEB); border-left: 4px solid var(--red-500); padding: 8px 12px; border-radius: 0 6px 6px 0; font-size: 13px; color: var(--red-900); display: flex; align-items: center; gap: 15px; margin-top: 5px;">
                    ${html_parts.join(` <span style="color: var(--red-300);">|</span> `)}
                </div>
            `;
            
            $(frm.wrapper).find("#student-financial-alert-container").html(header_alert);
            frm.dashboard.set_headline(html_parts.join(" &nbsp;|&nbsp; "));
        },
    });
}

function _render_modern_header(frm) {
    if (frm.is_new()) return;
    
    function get_initials(name) {
        const p = (name || "").split(" ");
        if (p.length === 1) return p[0].substring(0, 2).toUpperCase();
        return (p[0].charAt(0) + p[p.length - 1].charAt(0)).toUpperCase();
    }

    const initials = get_initials(frm.doc.full_name);
    
    const status = frm.doc.financial_status || "Regular";
    let color = "var(--text-color)", bg = "transparent";
    if (status === "Regular") { color = "var(--green-700)"; bg = "var(--green-100, #D1F0DB)"; }
    else if (status === "Em Dívida") { color = "var(--yellow-700)"; bg = "var(--yellow-100, #FFEDBF)"; }
    else if (status === "Em Dívida Crítica" || status === "Suspenso") { color = "var(--red-700)"; bg = "var(--red-100, #FBD5CD)"; }

    let enrol_status_color = frm.doc.current_status === "Activo" ? "var(--green-600)" : "var(--text-muted)";

    const html = `
        <div class="escola-modern-header" style="display: flex; align-items: flex-start; padding: 20px 24px; background: var(--bg-color); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.02); gap: 20px;">
            <div style="width: 72px; height: 72px; border-radius: 50%; background: var(--primary-color, #2490ef); color: white; display: flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 700; flex-shrink: 0; box-shadow: 0 4px 12px rgba(36, 144, 239, 0.3);">
                ${initials}
            </div>
            <div style="display: flex; flex-direction: column; flex: 1; padding-top: 4px;">
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <h2 style="margin: 0; font-weight: 700; color: var(--text-color); font-size: 22px; letter-spacing: -0.5px;">${frm.doc.full_name}</h2>
                    <span style="padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; background: ${bg}; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${__(status)}
                    </span>
                </div>
                <div style="display: flex; align-items: center; gap: 18px; margin-top: 10px; font-size: 13px; color: var(--text-muted);">
                    <span style="display:flex; align-items:center; gap:6px;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                        ${frm.doc.student_code || "Sem Código"}
                    </span>
                    <span style="display:flex; align-items:center; gap:6px; color:${enrol_status_color}; font-weight:600;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${enrol_status_color}; display: inline-block;"></span>
                        ${__(frm.doc.current_status)}
                    </span>
                    <span style="display:flex; align-items:center; gap:6px;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                        ${frm.doc.current_class_group || "Sem Turma Atribuída"}
                    </span>
                </div>
                <div id="student-financial-alert-container" style="margin-top: 14px;"></div>
            </div>
        </div>
    `;

    $(frm.wrapper).find('.escola-modern-header').remove();
    setTimeout(() => {
        $(frm.fields_dict.section_break_personal.wrapper).before(html);
    }, 100);
}

// ---------------------------------------------------------------------------
// Full name sync
// ---------------------------------------------------------------------------

function update_full_name(frm) {
    const parts = [frm.doc.first_name, frm.doc.last_name].filter(Boolean);
    frm.set_value("full_name", parts.join(" "));
}

// ---------------------------------------------------------------------------
// Reactivation dialog
// ---------------------------------------------------------------------------

function reactivate_dialog(frm) {
    const d = new frappe.ui.Dialog({
        title: __("Reactivar {0}", [frm.doc.full_name]),
        fields: [
            {
                fieldname: "academic_year",
                fieldtype: "Link",
                options: "Academic Year",
                label: __("Ano Lectivo"),
                reqd: 1,
                onchange() {
                    d.set_value("class_group", null);
                    d.fields_dict.class_group.get_query = () => ({
                        filters: build_filters(d),
                    });
                },
            },
            {
                fieldname: "school_class",
                fieldtype: "Link",
                options: "School Class",
                label: __("Classe"),
                get_query: () => ({ filters: { is_active: 1 } }),
                onchange() {
                    d.set_value("class_group", null);
                    d.fields_dict.class_group.get_query = () => ({
                        filters: build_filters(d),
                    });
                },
            },
            {
                fieldname: "class_group",
                fieldtype: "Link",
                options: "Class Group",
                label: __("Turma"),
                reqd: 1,
                get_query: () => ({ filters: build_filters(d) }),
                description: __("Seleccione a turma para o ano lectivo em curso."),
            },
        ],
        primary_action_label: __("Reactivar"),
        primary_action(values) {
            frappe.call({
                method: "escola.escola.doctype.inscricao.inscricao.reactivate_student",
                args: {
                    student_name: frm.doc.name,
                    class_group_name: values.class_group,
                },
                callback(r) {
                    if (r.exc) return;
                    d.hide();
                    frappe.show_alert({
                        message: __("Aluno reactivado e atribuído à turma."),
                        indicator: "green",
                    });
                    frm.reload_doc();
                },
            });
        },
    });
    d.show();
}

function build_filters(d) {
    const f = { is_active: 1 };
    const ay = d.get_value("academic_year");
    const sc = d.get_value("school_class");
    if (ay) f.academic_year = ay;
    if (sc) f.school_class = sc;
    return f;
}
