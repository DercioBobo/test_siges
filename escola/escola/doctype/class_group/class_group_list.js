frappe.listview_settings["Class Group"] = {
	get_indicator: function (doc) {
		if (doc.is_active) {
			return [__("Activa"), "green", "is_active,=,1"];
		} else {
			return [__("Encerrada"), "gray", "is_active,=,0"];
		}
	},
	formatters: {
		student_count(v, df, doc) {
			const count = parseInt(v) || 0;
			const max = parseInt(doc.max_students) || 0;
			
			if (max === 0) {
				return `<span style="font-weight: 500;">${count} <span style="font-size: 11px; color: var(--text-muted);">Alunos</span></span>`;
			}
			
			const percentage = Math.min(Math.round((count / max) * 100), 100);
			let color = "var(--primary-color)";
			if (percentage >= 100) color = "var(--red-500)";
			else if (percentage >= 90) color = "var(--orange-500)";
			
			return `
				<div style="display: flex; flex-direction: column; width: 120px; gap: 4px;">
					<div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-color); font-weight: 600;">
						<span>${count} / ${max}</span>
						<span style="color: ${color};">${percentage}%</span>
					</div>
					<div style="width: 100%; height: 6px; background: var(--bg-light-gray, #E2E8F0); border-radius: 4px; overflow: hidden;">
						<div style="height: 100%; width: ${percentage}%; background: ${color}; transition: width 0.3s ease;"></div>
					</div>
				</div>
			`;
		},
		group_name(v, df, doc) {
			return `
				<div style="display: flex; flex-direction: column; line-height: 1.3;">
					<span style="font-weight: 700; font-size: 14px; color: var(--text-color);">${v}</span>
					<span style="font-size: 11px; color: var(--text-muted);">${doc.academic_year || ""} &bull; ${doc.school_class || ""}</span>
				</div>
			`;
		}
	}
};
