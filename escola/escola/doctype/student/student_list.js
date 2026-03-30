frappe.listview_settings["Student"] = {
	hide_name_column: true, 
	add_fields: ["full_name", "student_code", "current_status", "financial_status", "gender"],
	get_indicator: function (doc) {
		let colors = {
			"Activo": "green",
			"Transferido": "blue",
			"Desistente": "gray",
			"Concluiu": "purple"
		};
		// Elevate financial risk into the main status indicator
		if (doc.financial_status === "Em Dívida Crítica" && doc.current_status === "Activo") {
			return [__("Risco Financeiro"), "red", "financial_status,=,Em Dívida Crítica"];
		}
		if (doc.financial_status === "Suspenso") {
			return [__("Suspenso"), "red", "financial_status,=,Suspenso"];
		}
		return [__(doc.current_status), colors[doc.current_status] || "gray", "current_status,=," + doc.current_status];
	},
	formatters: {
		full_name(v, df, doc) {
			function get_initials(name) {
				const p = (name || "").split(" ");
				if (p.length === 1) return p[0].substring(0, 2).toUpperCase();
				return (p[0].charAt(0) + p[p.length - 1].charAt(0)).toUpperCase();
			}
			
			const initials = get_initials(doc.full_name);
			// Modern Avatar Chip
			return `
				<div style="display: flex; align-items: center; gap: 10px; padding: 2px 0;">
					<div style="width: 28px; height: 28px; border-radius: 50%; background: var(--primary-color, #2490ef); color: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; flex-shrink: 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
						${initials}
					</div>
					<div style="display: flex; flex-direction: column; justify-content: center; line-height: 1.2;">
						<span style="font-weight: 600; font-size: 13px; color: var(--text-color);">${doc.full_name}</span>
						<span style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${doc.student_code || "Sem Código"}</span>
					</div>
				</div>
			`;
		},
		financial_status(v, df, doc) {
			if (!v) return "";
			let color = "var(--text-color)";
			let bg = "transparent";
			if (v === "Regular") { color = "var(--green-600)"; bg = "var(--green-50, #E6F6ED)"; }
			else if (v === "Em Dívida") { color = "var(--yellow-600)"; bg = "var(--yellow-50, #FFF8E6)"; }
			else if (v === "Em Dívida Crítica" || v === "Suspenso") { color = "var(--red-600)"; bg = "var(--red-50, #FCEEEB)"; }
			
			return `<span style="display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; color: ${color}; background: ${bg}; align-items: center;">${__(v)}</span>`;
		}
	}
};
