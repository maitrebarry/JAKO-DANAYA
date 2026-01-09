import React from 'react';

type Props = {
  title: string;
  subtitle?: string;
  value: string | number;
  icon?: string; // css class for icon
  bg?: string; // css class for bg color
};

const MetricCard = ({ title, subtitle, value, icon, bg = 'bg-primary' }: Props) => {
  return (
    <div className="col-xl-3 col-lg-6">
      <div className="card">
        <div className="card-body">
          <div className="d-flex align-items-center">
            <div className="flex-grow-1">
              <h4 className="mt-0 mb-1">{title}</h4>
              {subtitle && <p className="text-muted mb-0">{subtitle}</p>}
            </div>
            <div className="avatar-sm">
              <span className={`avatar-title ${bg} rounded-circle`}>
                {icon ? <i className={`${icon} font-24`}></i> : null}
              </span>
            </div>
          </div>
          <h3 className="mt-3 mb-0">{value}</h3>
        </div>
      </div>
    </div>
  );
};

export default MetricCard;
